use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::oracle::{calculate_call_option_payout, get_btc_usd_price_cents};
use crate::storage::{
    get_active_option, list_expired_active_options, release_locked_to_recipient,
    reverse_release_locked_to_recipient, unlock_collateral, update_active_option, ActiveOption,
    ActiveOptionStatus, OptionType,
};

use super::transfer_ckbtc;

pub struct SettlementResult {
    pub option_id: u64,
    pub settlement_price_cents: u64,
    pub payout_to_buyer: u64,
    pub payout_to_writer: u64,
    pub status: ActiveOptionStatus,
}

pub struct SettleExpiredOptionsResult {
    pub settled: Vec<SettlementResult>,
    pub errors: Vec<String>,
}

pub async fn settle_single_option(
    option: &mut ActiveOption,
    settlement_price_cents: u64,
) -> Result<SettlementResult, VolumetricError> {
    ic_cdk::println!(
        "settle_single_option: id={}, status={:?}, settlement_price={}",
        option.id,
        option.status,
        settlement_price_cents
    );

    if option.status == ActiveOptionStatus::Settling {
        return Err(VolumetricError::option_settling());
    }
    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::option_already_settled());
    }

    option.status = ActiveOptionStatus::Settling;
    update_active_option(option.clone());

    let payout_to_buyer = match option.option_type {
        OptionType::Call => calculate_call_option_payout(
            settlement_price_cents,
            option.strike_price_cents,
            option.quantity,
        ),
    };

    let payout_to_writer = option.quantity.saturating_sub(payout_to_buyer);

    ic_cdk::println!(
        "settle_single_option: quantity={}, payout_buyer={}, payout_writer={}",
        option.quantity,
        payout_to_buyer,
        payout_to_writer
    );

    if payout_to_buyer > 0 {
        release_locked_to_recipient(option.writer, option.buyer, payout_to_buyer)
            .map_err(|e| VolumetricError::insufficient_balance(e.available, e.required))?;

        let writer_subaccount = derive_subaccount(option.writer);
        let buyer_subaccount = derive_subaccount(option.buyer);

        ic_cdk::println!(
            "settle: transferring {} from writer to buyer",
            payout_to_buyer
        );

        if let Err(e) = transfer_ckbtc(
            Some(writer_subaccount),
            Account {
                owner: ic_cdk::api::canister_self(),
                subaccount: Some(buyer_subaccount),
            },
            payout_to_buyer,
        )
        .await
        {
            ic_cdk::println!(
                "settle: buyer transfer failed: {:?}, reversing balance changes",
                e
            );
            if let Err(reverse_err) =
                reverse_release_locked_to_recipient(option.writer, option.buyer, payout_to_buyer)
            {
                ic_cdk::println!(
                    "settle: CRITICAL - failed to reverse balance changes: {:?}",
                    reverse_err
                );
            }
            option.status = ActiveOptionStatus::Active;
            update_active_option(option.clone());
            return Err(e);
        }
    }

    if payout_to_writer > 0 {
        unlock_collateral(option.writer, payout_to_writer)
            .map_err(|e| VolumetricError::insufficient_balance(e.available, e.required))?;
    }

    option.status = ActiveOptionStatus::Settled;
    update_active_option(option.clone());

    Ok(SettlementResult {
        option_id: option.id,
        settlement_price_cents,
        payout_to_buyer,
        payout_to_writer,
        status: ActiveOptionStatus::Settled,
    })
}

pub async fn settle_expired_options_use_case() -> SettleExpiredOptionsResult {
    let now = ic_cdk::api::time();
    let expired_options = list_expired_active_options(now);

    let mut settled: Vec<SettlementResult> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    let settlement_price_cents = match get_btc_usd_price_cents() {
        Ok(price) => price,
        Err(e) => {
            errors.push(format!("Failed to get oracle price: {}", e));
            return SettleExpiredOptionsResult { settled, errors };
        }
    };

    for mut option in expired_options {
        match settle_single_option(&mut option, settlement_price_cents).await {
            Ok(result) => settled.push(result),
            Err(e) => errors.push(format!("Option {}: {}", option.id, e)),
        }
    }

    SettleExpiredOptionsResult { settled, errors }
}

pub async fn settle_option_by_id_use_case(
    option_id: u64,
) -> Result<SettlementResult, VolumetricError> {
    let now = ic_cdk::api::time();
    let mut option =
        get_active_option(option_id).ok_or_else(|| VolumetricError::option_not_found(option_id))?;

    if option.expiry > now {
        return Err(VolumetricError::option_not_expired());
    }

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::option_already_settled());
    }

    let settlement_price_cents = get_btc_usd_price_cents()?;
    settle_single_option(&mut option, settlement_price_cents).await
}

pub async fn testing_force_settle_option_use_case(
    option_id: u64,
) -> Result<SettlementResult, VolumetricError> {
    let mut option =
        get_active_option(option_id).ok_or_else(|| VolumetricError::option_not_found(option_id))?;

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::option_already_settled());
    }

    let settlement_price_cents = get_btc_usd_price_cents()?;
    settle_single_option(&mut option, settlement_price_cents).await
}

// TODO: Re-enable automatic settlement timer for production.
pub fn setup_settlement_timer() {
    // Disabled for testing - manually call settle_expired_options() or settle_option_by_id()
}

use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::ic;
use crate::locks::SettlementLock;
use crate::oracle::get_btc_usd_price_cents;
use crate::storage::{
    add_platform_fee, calculate_call_option_payout, calculate_profit_fee, complete_settlement,
    create_settlement, emit_event, fail_settlement, get_active_option, get_fee_recipient,
    list_expired_active_options, release_locked_to_buyer, remove_settlement,
    reverse_release_locked_to_buyer, subtract_available, unlock_collateral, update_active_option,
    update_settlement_phase, ActiveOption, ActiveOptionStatus, EventData, EventType, OptionType,
    SettlementPhase, TradeRole,
};

use crate::usecases::balances::{
    prefetch_ckbtc_transfer_fee, transfer_ckbtc_with_cached_fee_retry,
};

pub struct SettlementResult {
    pub option_id: u64,
    pub settlement_price_cents: u64,
    pub payout_to_buyer: u64,
    pub payout_to_writer: u64,
    pub profit_fee: u64,
    pub status: ActiveOptionStatus,
}

pub struct SettleExpiredOptionsResult {
    pub settled: Vec<SettlementResult>,
    pub errors: Vec<String>,
}

pub async fn settle_single_option(
    option_id: u64,
    settlement_price_cents: u64,
) -> Result<SettlementResult, VolumetricError> {
    let _lock = SettlementLock::new(option_id)?;
    let mut option =
        get_active_option(option_id).ok_or_else(|| VolumetricError::option_not_found(option_id))?;
    let created_at_time = ic::time();

    ic::log(&format!(
        "settle_single_option: id={}, status={:?}, settlement_price={}",
        option.id, option.status, settlement_price_cents
    ));

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::option_already_settled());
    }

    prefetch_ckbtc_transfer_fee().await?;

    option.status = ActiveOptionStatus::Settling;
    update_active_option(option.clone());

    let gross_payout_to_buyer = match option.option_type {
        OptionType::Call => calculate_call_option_payout(
            settlement_price_cents,
            option.strike_price_cents,
            option.quantity,
        ),
    };

    let profit_fee = if gross_payout_to_buyer > 0 {
        calculate_profit_fee(gross_payout_to_buyer, option.profit_fee_basis_points)
    } else {
        0
    };

    let payout_to_buyer = gross_payout_to_buyer.saturating_sub(profit_fee);
    let payout_to_writer = option.quantity.saturating_sub(gross_payout_to_buyer);

    ic::log(&format!(
        "settle_single_option: quantity={}, gross_payout_buyer={}, profit_fee={}, net_payout_buyer={}, payout_writer={}",
        option.quantity, gross_payout_to_buyer, profit_fee, payout_to_buyer, payout_to_writer
    ));

    create_settlement(
        option.id,
        option.writer,
        option.buyer,
        payout_to_buyer,
        payout_to_writer,
        settlement_price_cents,
    );

    if gross_payout_to_buyer > 0 {
        release_locked_to_buyer(option.writer, option.buyer, payout_to_buyer)
            .map_err(|e| VolumetricError::insufficient_balance(e.available, e.required))?;

        if profit_fee > 0 {
            unlock_collateral(option.writer, profit_fee)
                .map_err(|e| VolumetricError::insufficient_balance(e.available, e.required))?;
        }

        update_settlement_phase(option.id, SettlementPhase::BalanceReleased);

        let writer_subaccount = derive_subaccount(option.writer);
        let buyer_subaccount = derive_subaccount(option.buyer);

        ic::log(&format!(
            "settle: transferring {} from writer to buyer",
            payout_to_buyer
        ));

        if let Err(e) = transfer_ckbtc_with_cached_fee_retry(
            Some(writer_subaccount),
            Account {
                owner: ic::canister_self(),
                subaccount: Some(buyer_subaccount),
            },
            payout_to_buyer,
            created_at_time,
        )
        .await
        {
            ic::log(&format!(
                "settle: buyer transfer failed: {:?}, reversing balance changes",
                e
            ));
            if let Err(reverse_err) =
                reverse_release_locked_to_buyer(option.writer, option.buyer, payout_to_buyer)
            {
                ic::log(&format!(
                    "settle: CRITICAL - failed to reverse balance changes: {:?}",
                    reverse_err
                ));
            }
            option.status = ActiveOptionStatus::Active;
            update_active_option(option.clone());
            fail_settlement(option.id, format!("transfer_ckbtc failed: {:?}", e));
            return Err(e);
        }

        if profit_fee > 0 {
            ic::log(&format!(
                "settle: transferring profit fee {} to platform",
                profit_fee
            ));

            if let Err(e) = transfer_ckbtc_with_cached_fee_retry(
                Some(writer_subaccount),
                Account {
                    owner: get_fee_recipient(),
                    subaccount: None,
                },
                profit_fee,
                created_at_time,
            )
            .await
            {
                ic::log(&format!(
                    "settle: profit fee transfer failed: {:?}, continuing anyway",
                    e
                ));
            } else {
                add_platform_fee(profit_fee);
                // Deduct profit fee from writer's available balance since it was transferred to platform
                if let Err(e) = subtract_available(option.writer, profit_fee) {
                    ic::log(&format!(
                        "settle: CRITICAL - failed to subtract profit fee from writer balance: {:?}",
                        e
                    ));
                }
            }
        }

        update_settlement_phase(option.id, SettlementPhase::TransferComplete);
    }

    if payout_to_writer > 0 {
        unlock_collateral(option.writer, payout_to_writer)
            .map_err(|e| VolumetricError::insufficient_balance(e.available, e.required))?;
    }

    option.status = ActiveOptionStatus::Settled;
    update_active_option(option.clone());

    complete_settlement(option.id);
    remove_settlement(option.id);

    let settled_at_ns = ic::time();

    emit_event(
        option.buyer,
        EventType::OptionSettled,
        EventData::OptionSettled {
            option_id: option.id,
            quantity_sats: option.quantity,
            entry_price_cents: option.entry_price_cents,
            strike_price_cents: option.strike_price_cents,
            settlement_price_cents,
            premium_sats: option.premium_paid,
            payout_sats: payout_to_buyer,
            accepted_at_ns: option.accepted_at,
            settled_at_ns,
            role: TradeRole::Buyer,
        },
    );

    emit_event(
        option.writer,
        EventType::OptionSettled,
        EventData::OptionSettled {
            option_id: option.id,
            quantity_sats: option.quantity,
            entry_price_cents: option.entry_price_cents,
            strike_price_cents: option.strike_price_cents,
            settlement_price_cents,
            premium_sats: option.premium_paid,
            payout_sats: payout_to_writer,
            accepted_at_ns: option.accepted_at,
            settled_at_ns,
            role: TradeRole::Writer,
        },
    );

    Ok(SettlementResult {
        option_id: option.id,
        settlement_price_cents,
        payout_to_buyer,
        payout_to_writer,
        profit_fee,
        status: ActiveOptionStatus::Settled,
    })
}

pub async fn settle_expired_options_use_case() -> SettleExpiredOptionsResult {
    let now = ic::time();
    let expired_options = list_expired_active_options(now);

    let mut settled: Vec<SettlementResult> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    let settlement_price_cents = match get_btc_usd_price_cents().await {
        Ok(price) => price,
        Err(e) => {
            errors.push(format!("Failed to get oracle price: {}", e));
            return SettleExpiredOptionsResult { settled, errors };
        }
    };

    for option in expired_options {
        match settle_single_option(option.id, settlement_price_cents).await {
            Ok(result) => settled.push(result),
            Err(e) => errors.push(format!("Option {}: {}", option.id, e)),
        }
    }

    SettleExpiredOptionsResult { settled, errors }
}

pub async fn settle_option_by_id_use_case(
    option_id: u64,
) -> Result<SettlementResult, VolumetricError> {
    let now = ic::time();

    let option =
        get_active_option(option_id).ok_or_else(|| VolumetricError::option_not_found(option_id))?;

    if option.expiry > now {
        return Err(VolumetricError::option_not_expired());
    }

    let settlement_price_cents = get_btc_usd_price_cents().await?;
    settle_single_option(option_id, settlement_price_cents).await
}

pub async fn testing_force_settle_option_use_case(
    option_id: u64,
) -> Result<SettlementResult, VolumetricError> {
    let settlement_price_cents = get_btc_usd_price_cents().await?;
    settle_single_option(option_id, settlement_price_cents).await
}

pub fn testing_expire_option_use_case(option_id: u64) -> Result<ActiveOption, VolumetricError> {
    let mut option =
        get_active_option(option_id).ok_or_else(|| VolumetricError::option_not_found(option_id))?;

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::option_already_settled());
    }

    option.expiry = 0;
    update_active_option(option.clone());

    Ok(option)
}

pub fn testing_set_option_expiry_use_case(
    option_id: u64,
    expiry_ns: u64,
) -> Result<ActiveOption, VolumetricError> {
    let mut option =
        get_active_option(option_id).ok_or_else(|| VolumetricError::option_not_found(option_id))?;

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::option_already_settled());
    }

    option.expiry = expiry_ns;
    update_active_option(option.clone());

    Ok(option)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use std::rc::Rc;

    use async_trait::async_trait;
    use candid::{Nat, Principal};
    use icrc_ledger_types::icrc2::approve::ApproveArgs;

    use crate::ic::IcRuntime;
    use crate::ledger::LedgerClient;
    use crate::storage::{
        clear_active_options, get_balance, get_settlement, insert_active_option, remove_settlement,
        set_balance, ActiveOption, ActiveOptionStatus, Asset, OptionType, SettlementPhase,
        UserBalance,
    };
    use crate::usecases::balances::{
        testing_clear_transfer_fee_cache, testing_set_transfer_fee_cache,
    };
    use crate::{ic, ledger};

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const TEST_OPTION_ID: u64 = 50_001;
    const TEST_SETTLEMENT_PRICE_CENTS: u64 = 200_000;
    const TEST_STRIKE_PRICE_CENTS: u64 = 100_000;
    const TEST_QUANTITY_SATS: u64 = 100_000;
    const STALE_CACHED_FEE: u64 = 10;
    const CURRENT_LEDGER_FEE: u64 = 15;

    fn writer_principal() -> Principal {
        Principal::from_slice(&[11; 29])
    }

    fn buyer_principal() -> Principal {
        Principal::from_slice(&[12; 29])
    }

    struct MockRuntime;

    impl IcRuntime for MockRuntime {
        fn time(&self) -> u64 {
            TEST_NOW_NS
        }

        fn canister_self(&self) -> Principal {
            Principal::anonymous()
        }

        fn log(&self, _message: &str) {}
    }

    struct MockLedger {
        expected_fee: u64,
        fail_even_with_correct_fee: bool,
        transfer_attempts: Cell<u64>,
        fee_queries: Cell<u64>,
    }

    #[async_trait(?Send)]
    impl LedgerClient for MockLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
            expected_fee: Option<u64>,
        ) -> Result<u64, VolumetricError> {
            let attempt = self.transfer_attempts.get().saturating_add(1);
            self.transfer_attempts.set(attempt);

            if expected_fee != Some(self.expected_fee) {
                return Err(VolumetricError::inter_canister_call_failed(&format!(
                    "icrc1_transfer bad_fee expected_fee: {}",
                    self.expected_fee
                )));
            }

            if self.fail_even_with_correct_fee {
                return Err(VolumetricError::inter_canister_call_failed(
                    "icrc1_transfer rejected: transient",
                ));
            }

            Ok(123)
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            self.fee_queries
                .set(self.fee_queries.get().saturating_add(1));
            Ok(self.expected_fee)
        }
    }

    fn seed_option_state(option_id: u64) {
        let writer = writer_principal();
        let buyer = buyer_principal();

        set_balance(
            writer,
            UserBalance {
                available: 0,
                locked_as_writer: TEST_QUANTITY_SATS,
            },
        );

        set_balance(
            buyer,
            UserBalance {
                available: 0,
                locked_as_writer: 0,
            },
        );

        insert_active_option(ActiveOption {
            id: option_id,
            offer_id: 1,
            buyer,
            writer,
            asset: Asset::CkBtc,
            option_type: OptionType::Call,
            quantity: TEST_QUANTITY_SATS,
            entry_price_cents: TEST_STRIKE_PRICE_CENTS,
            strike_price_cents: TEST_STRIKE_PRICE_CENTS,
            premium_paid: 1_000,
            accepted_at: TEST_NOW_NS,
            expiry: 0,
            status: ActiveOptionStatus::Active,
            fill_group_id: None,
            profit_fee_basis_points: 0,
        });
    }

    fn setup(mock_ledger: Rc<MockLedger>) {
        clear_active_options();
        testing_clear_transfer_fee_cache();
        ic::set_runtime(Box::new(MockRuntime));
        ledger::set_ledger(mock_ledger);
    }

    /// Given: stale cached transfer fee
    /// When: settle_single_option executes
    /// Then: it refreshes fee and retries once successfully
    #[tokio::test]
    async fn test_settlement_refreshes_fee_and_retries_once() {
        // given
        let mock_ledger = Rc::new(MockLedger {
            expected_fee: CURRENT_LEDGER_FEE,
            fail_even_with_correct_fee: false,
            transfer_attempts: Cell::new(0),
            fee_queries: Cell::new(0),
        });
        setup(Rc::clone(&mock_ledger));
        seed_option_state(TEST_OPTION_ID);
        testing_set_transfer_fee_cache(STALE_CACHED_FEE, TEST_NOW_NS);

        // when
        let result = settle_single_option(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS).await;

        // then
        assert!(result.is_ok());
        assert_eq!(mock_ledger.transfer_attempts.get(), 2);
        assert_eq!(mock_ledger.fee_queries.get(), 1);

        let buyer_balance = get_balance(&buyer_principal());
        let writer_balance = get_balance(&writer_principal());
        let expected_payout_to_buyer = TEST_QUANTITY_SATS / 2;
        let expected_payout_to_writer = TEST_QUANTITY_SATS - expected_payout_to_buyer;

        assert_eq!(buyer_balance.available, expected_payout_to_buyer);
        assert_eq!(writer_balance.available, expected_payout_to_writer);
        assert_eq!(writer_balance.locked_as_writer, 0);
        assert!(get_settlement(TEST_OPTION_ID).is_none());
    }

    /// Given: stale cached fee and retry still fails
    /// When: settle_single_option executes
    /// Then: it reverses released balances and marks settlement failed
    #[tokio::test]
    async fn test_settlement_retry_failure_restores_state() {
        // given
        let option_id = TEST_OPTION_ID + 1;
        let mock_ledger = Rc::new(MockLedger {
            expected_fee: CURRENT_LEDGER_FEE,
            fail_even_with_correct_fee: true,
            transfer_attempts: Cell::new(0),
            fee_queries: Cell::new(0),
        });
        setup(Rc::clone(&mock_ledger));
        seed_option_state(option_id);
        testing_set_transfer_fee_cache(STALE_CACHED_FEE, TEST_NOW_NS);

        // when
        let result = settle_single_option(option_id, TEST_SETTLEMENT_PRICE_CENTS).await;

        // then
        assert!(result.is_err());
        assert_eq!(mock_ledger.transfer_attempts.get(), 2);
        assert_eq!(mock_ledger.fee_queries.get(), 1);

        let buyer_balance = get_balance(&buyer_principal());
        let writer_balance = get_balance(&writer_principal());

        assert_eq!(buyer_balance.available, 0);
        assert_eq!(writer_balance.available, 0);
        assert_eq!(writer_balance.locked_as_writer, TEST_QUANTITY_SATS);

        let option = get_active_option(option_id).unwrap();
        assert_eq!(option.status, ActiveOptionStatus::Active);

        let settlement = get_settlement(option_id).unwrap();
        assert!(matches!(settlement.phase, SettlementPhase::Failed { .. }));

        remove_settlement(option_id);
    }
}

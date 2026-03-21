use candid::CandidType;
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

use crate::auth::derive_subaccount;
use crate::errors::{error_codes, VolumetricError};
use crate::ic;
use crate::journaling::{
    default_policy, enqueue_if_absent, execute_wal_entry_now, register_retryable_error,
    OperationId, SettlementWalPayload, WalExecutionError, WalExecutionOutcome, WalKind, WalPayload,
};
use crate::locks::SettlementLock;
use crate::oracle::get_btc_usd_price_cents;
use crate::storage::{
    add_platform_fee, calculate_call_option_payout, calculate_profit_fee, complete_settlement,
    create_settlement, emit_event, get_active_option, get_fee_recipient, get_settlement,
    list_expired_active_options, release_locked_to_buyer, remove_settlement, subtract_available,
    unlock_collateral, update_active_option, update_settlement_phase, ActiveOption,
    ActiveOptionStatus, EventData, EventType, OptionType, SettlementPhase, TradeRole,
};

use crate::usecases::balances::transfer_ckbtc;

pub struct SettlementResult {
    pub option_id: u64,
    pub settlement_price_cents: u64,
    pub payout_to_buyer: u64,
    pub payout_to_writer: u64,
    pub profit_fee: u64,
    pub status: ActiveOptionStatus,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct SettlementWalResult {
    pub option_id: u64,
}

pub struct SettleExpiredOptionsResult {
    pub settled: Vec<SettlementResult>,
    pub errors: Vec<String>,
}

struct PreparedSettlementExecution {
    operation_id: OperationId,
    option_id: u64,
    settlement_price_cents: u64,
    payout_to_buyer: u64,
    payout_to_writer: u64,
    profit_fee: u64,
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

pub async fn settle_single_option(
    option_id: u64,
    settlement_price_cents: u64,
) -> Result<SettlementResult, VolumetricError> {
    let _lock = SettlementLock::new(option_id)?;
    let prepared_settlement_execution =
        prepare_settlement_execution(option_id, settlement_price_cents)?;
    let wal_execution_outcome =
        execute_wal_entry_now(prepared_settlement_execution.operation_id).await;

    finish_settlement_execution(prepared_settlement_execution, wal_execution_outcome)
}

fn prepare_settlement_execution(
    option_id: u64,
    settlement_price_cents: u64,
) -> Result<PreparedSettlementExecution, VolumetricError> {
    let mut option = get_active_option(option_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::OPTION_NOT_FOUND,
            Some(&format!("id: {}", option_id)),
            None,
        )
    })?;
    if option.status == ActiveOptionStatus::Settling {
        return Err(VolumetricError::from_def(
            error_codes::OPTION_SETTLING,
            None,
            None,
        ));
    }

    ic::log(&format!(
        "settle_single_option: id={}, status={:?}, settlement_price={}",
        option.id, option.status, settlement_price_cents
    ));

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::from_def(
            error_codes::OPTION_ALREADY_SETTLED,
            None,
            None,
        ));
    }

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
    let created_at_time_ns = ic::time();

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

    let operation_id = settlement_operation_id(option.id);
    enqueue_if_absent(
        operation_id,
        WalKind::Settlement,
        WalPayload::Settlement(SettlementWalPayload {
            option_id: option.id,
            settlement_price_cents,
            created_at_time_ns,
        }),
        default_policy(),
    );

    Ok(PreparedSettlementExecution {
        operation_id,
        option_id: option.id,
        settlement_price_cents,
        payout_to_buyer,
        payout_to_writer,
        profit_fee,
    })
}

fn finish_settlement_execution(
    prepared_settlement_execution: PreparedSettlementExecution,
    wal_execution_outcome: WalExecutionOutcome,
) -> Result<SettlementResult, VolumetricError> {
    match wal_execution_outcome {
        WalExecutionOutcome::Succeeded | WalExecutionOutcome::SucceededAlready => {
            Ok(SettlementResult {
                option_id: prepared_settlement_execution.option_id,
                settlement_price_cents: prepared_settlement_execution.settlement_price_cents,
                payout_to_buyer: prepared_settlement_execution.payout_to_buyer,
                payout_to_writer: prepared_settlement_execution.payout_to_writer,
                profit_fee: prepared_settlement_execution.profit_fee,
                status: ActiveOptionStatus::Settled,
            })
        }
        WalExecutionOutcome::SkippedAlreadyInFlight | WalExecutionOutcome::FailedRetryable(_) => {
            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("settlement queued for retry"),
                None,
            ))
        }
        WalExecutionOutcome::FailedPermanent(message) => Err(VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some(&message),
            None,
        )),
    }
}

pub async fn run_settlement_wal(
    payload: &SettlementWalPayload,
) -> Result<SettlementWalResult, WalExecutionError> {
    let mut option = get_active_option(payload.option_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!("settlement option {} not found", payload.option_id))
    })?;

    let settlement = get_settlement(payload.option_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "settlement journal {} not found",
            payload.option_id
        ))
    })?;

    if option.status == ActiveOptionStatus::Settled {
        return Ok(SettlementWalResult {
            option_id: option.id,
        });
    }

    let writer_subaccount = derive_subaccount(option.writer);
    let buyer_subaccount = derive_subaccount(option.buyer);
    let payout_to_buyer = settlement.payout_to_buyer;
    let payout_to_writer = settlement.payout_to_writer;
    let gross_payout_to_buyer = option.quantity.saturating_sub(payout_to_writer);
    let profit_fee = gross_payout_to_buyer.saturating_sub(payout_to_buyer);

    if settlement.phase == SettlementPhase::Started && payout_to_buyer > 0 {
        transfer_ckbtc(
            Some(writer_subaccount),
            Account {
                owner: ic::canister_self(),
                subaccount: Some(buyer_subaccount),
            },
            payout_to_buyer,
            payload.created_at_time_ns,
        )
        .await
        .map_err(register_retryable_error)?;

        update_settlement_phase(option.id, SettlementPhase::TransferComplete);
    }

    let settlement = get_settlement(payload.option_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "settlement journal {} missing after transfer",
            option.id
        ))
    })?;

    if matches!(
        settlement.phase,
        SettlementPhase::Started | SettlementPhase::TransferComplete
    ) {
        if payout_to_buyer > 0 {
            release_locked_to_buyer(option.writer, option.buyer, payout_to_buyer)
                .map_err(map_balance_error_to_permanent)?;

            if profit_fee > 0 {
                unlock_collateral(option.writer, profit_fee)
                    .map_err(map_balance_error_to_permanent)?;
            }
        }

        update_settlement_phase(option.id, SettlementPhase::BalanceReleased);
    }

    let settlement = get_settlement(payload.option_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "settlement journal {} missing before finalization",
            option.id
        ))
    })?;

    if settlement.phase == SettlementPhase::BalanceReleased && profit_fee > 0 {
        transfer_ckbtc(
            Some(writer_subaccount),
            Account {
                owner: get_fee_recipient(),
                subaccount: None,
            },
            profit_fee,
            payload.created_at_time_ns,
        )
        .await
        .map_err(register_retryable_error)?;

        add_platform_fee(profit_fee);
        subtract_available(option.writer, profit_fee).map_err(map_balance_error_to_permanent)?;
    }

    if payout_to_writer > 0 {
        unlock_collateral(option.writer, payout_to_writer)
            .map_err(map_balance_error_to_permanent)?;
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
            settlement_price_cents: payload.settlement_price_cents,
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
            settlement_price_cents: payload.settlement_price_cents,
            premium_sats: option.premium_paid,
            payout_sats: payout_to_writer,
            accepted_at_ns: option.accepted_at,
            settled_at_ns,
            role: TradeRole::Writer,
        },
    );

    Ok(SettlementWalResult {
        option_id: option.id,
    })
}

fn settlement_operation_id(option_id: u64) -> OperationId {
    let option_id_bytes = option_id.to_be_bytes();
    OperationId::from_parts(&[b"settlement", &option_id_bytes])
}

fn map_balance_error_to_permanent(error: crate::storage::InsufficientBalance) -> WalExecutionError {
    WalExecutionError::Permanent(format!(
        "insufficient balance during settlement recovery: available={}, required={}",
        error.available, error.required
    ))
}

pub async fn settle_option_by_id_use_case(
    option_id: u64,
) -> Result<SettlementResult, VolumetricError> {
    let now = ic::time();

    let option = get_active_option(option_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::OPTION_NOT_FOUND,
            Some(&format!("id: {}", option_id)),
            None,
        )
    })?;

    if option.expiry > now {
        return Err(VolumetricError::from_def(
            error_codes::OPTION_NOT_EXPIRED,
            None,
            None,
        ));
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
    let mut option = get_active_option(option_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::OPTION_NOT_FOUND,
            Some(&format!("id: {}", option_id)),
            None,
        )
    })?;

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::from_def(
            error_codes::OPTION_ALREADY_SETTLED,
            None,
            None,
        ));
    }

    option.expiry = 0;
    update_active_option(option.clone());

    Ok(option)
}

pub fn testing_set_option_expiry_use_case(
    option_id: u64,
    expiry_ns: u64,
) -> Result<ActiveOption, VolumetricError> {
    let mut option = get_active_option(option_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::OPTION_NOT_FOUND,
            Some(&format!("id: {}", option_id)),
            None,
        )
    })?;

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::from_def(
            error_codes::OPTION_ALREADY_SETTLED,
            None,
            None,
        ));
    }

    option.expiry = expiry_ns;
    update_active_option(option.clone());

    Ok(option)
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use async_trait::async_trait;
    use candid::{Nat, Principal};
    use icrc_ledger_types::icrc2::approve::ApproveArgs;

    use super::*;
    use crate::ic::IcRuntime;
    use crate::ledger::{self, LedgerClient};
    use crate::storage::{
        clear_active_options, clear_events, get_balance, get_settlement, insert_active_option,
        list_failed_settlements, list_pending_settlements_journal, remove_settlement, set_balance,
        UserBalance,
    };

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const TEST_OPTION_ID: u64 = 1;
    const TEST_QUANTITY_SATS: u64 = 1_000_000;
    const TEST_ENTRY_PRICE_CENTS: u64 = 10_000_000;
    const TEST_STRIKE_PRICE_CENTS: u64 = 10_500_000;
    const TEST_SETTLEMENT_PRICE_CENTS: u64 = 12_000_000;
    const TEST_PROFIT_FEE_BASIS_POINTS: u64 = 1_000;

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

    struct FailingBuyerTransferLedger;

    #[async_trait(?Send)]
    impl LedgerClient for FailingBuyerTransferLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
        ) -> Result<u64, VolumetricError> {
            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("buyer transfer failed"),
                None,
            ))
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }
    }

    fn test_principal(seed: u8) -> Principal {
        Principal::from_slice(&[seed; 29])
    }

    fn clear_settlement_journal() {
        for settlement in list_pending_settlements_journal() {
            remove_settlement(settlement.option_id);
        }

        for settlement in list_failed_settlements() {
            remove_settlement(settlement.option_id);
        }
    }

    fn setup_test_state(writer: Principal, buyer: Principal) {
        clear_active_options();
        clear_events();
        clear_settlement_journal();
        ic::set_runtime(Box::new(MockRuntime));
        ledger::set_ledger(Rc::new(FailingBuyerTransferLedger));

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
            id: TEST_OPTION_ID,
            offer_id: 1,
            buyer,
            writer,
            asset: crate::storage::Asset::CkBtc,
            option_type: OptionType::Call,
            quantity: TEST_QUANTITY_SATS,
            entry_price_cents: TEST_ENTRY_PRICE_CENTS,
            strike_price_cents: TEST_STRIKE_PRICE_CENTS,
            premium_paid: 10_000,
            accepted_at: TEST_NOW_NS,
            expiry: TEST_NOW_NS.saturating_sub(1),
            status: ActiveOptionStatus::Active,
            fill_group_id: None,
            profit_fee_basis_points: TEST_PROFIT_FEE_BASIS_POINTS,
        });
    }

    /// Given: settlement needs to pay the buyer and collect a profit fee
    /// When: the first ledger transfer to the buyer fails
    /// Then: no internal balance changes leak across the await boundary and WAL recovery keeps the option pending
    #[tokio::test]
    async fn test_settle_single_option_keeps_balances_atomic_on_buyer_transfer_failure() {
        // given
        let writer = test_principal(1);
        let buyer = test_principal(2);
        setup_test_state(writer, buyer);

        // when
        let result = settle_single_option(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS).await;

        // then
        assert!(
            result.is_err(),
            "settlement should fail when buyer transfer fails"
        );
        let error = result.err().expect("settlement should return an error");
        assert_eq!(error.code, error_codes::INTER_CANISTER_CALL_FAILED.code);

        let writer_balance = get_balance(&writer);
        assert_eq!(writer_balance.available, 0);
        assert_eq!(writer_balance.locked_as_writer, TEST_QUANTITY_SATS);

        let buyer_balance = get_balance(&buyer);
        assert_eq!(buyer_balance.available, 0);
        assert_eq!(buyer_balance.locked_as_writer, 0);

        let option = get_active_option(TEST_OPTION_ID).expect("option should remain in storage");
        assert_eq!(option.status, ActiveOptionStatus::Settling);

        let settlement = get_settlement(TEST_OPTION_ID).expect("failed settlement should remain");
        assert_eq!(settlement.phase, SettlementPhase::Started);
    }
}

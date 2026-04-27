use std::cell::RefCell;
use std::collections::BTreeSet;

use scopeguard::guard;

use crate::errors::{error_codes, VolumetricError};
use crate::time::current_time_seconds;
use crate::usecases::{
    finalize_failed_accept_wal, finalize_failed_settlement_wal, finalize_failed_withdrawal_wal,
    run_accept_wal, run_settlement_wal, run_withdrawal_wal,
};

use super::super::OperationId;
use super::store::{get_entry, put_entry};
use super::types::{WalExecutionError, WalExecutionOutcome, WalPayload, WalResult, WalStatus};

const WAL_ENTRY_NOT_FOUND_MESSAGE: &str = "WAL entry not found";

// TODO: Replace string message-pattern retry classification with typed error mapping
const RETRYABLE_INTER_CANISTER_ERROR_PATTERNS: [&str; 6] = [
    "temporarily unavailable",
    "already processing",
    "sys_unknown",
    "queue",
    "call failed",
    "rejected",
];

thread_local! {
    static WAL_EXECUTION_IN_PROGRESS_OPERATION_IDS: RefCell<BTreeSet<OperationId>> =
        const { RefCell::new(BTreeSet::new()) };
}

pub fn register_retryable_error(error: VolumetricError) -> WalExecutionError {
    if !is_retryable_error(&error) {
        WalExecutionError::Permanent(error.to_string())
    } else {
        WalExecutionError::Retryable(error.to_string())
    }
}

pub async fn execute_wal_entry_now(operation_id: OperationId) -> WalExecutionOutcome {
    let Some(existing_wal_entry) = get_entry(operation_id) else {
        return WalExecutionOutcome::FailedPermanent(WAL_ENTRY_NOT_FOUND_MESSAGE.to_string());
    };

    if existing_wal_entry.status == WalStatus::Succeeded {
        return WalExecutionOutcome::SucceededAlready;
    }

    if !mark_wal_execution_in_progress_if_idle(operation_id) {
        return WalExecutionOutcome::SkippedAlreadyInFlight;
    }

    let _wal_execution_guard = guard(operation_id, |operation_id| {
        WAL_EXECUTION_IN_PROGRESS_OPERATION_IDS.with(|in_progress_operation_ids| {
            in_progress_operation_ids.borrow_mut().remove(&operation_id);
        });
    });

    execute_wal_entry_attempt(operation_id).await
}

fn mark_wal_execution_in_progress_if_idle(operation_id: OperationId) -> bool {
    WAL_EXECUTION_IN_PROGRESS_OPERATION_IDS.with(|in_progress_operation_ids| {
        let mut in_progress_operation_ids = in_progress_operation_ids.borrow_mut();
        if in_progress_operation_ids.contains(&operation_id) {
            return false;
        }
        in_progress_operation_ids.insert(operation_id);
        true
    })
}

async fn execute_wal_entry_attempt(operation_id: OperationId) -> WalExecutionOutcome {
    let Some(mut wal_entry) = get_entry(operation_id) else {
        logging::error!(
            "wal entry missing during execution attempt operation_id={:?}",
            operation_id
        );
        return WalExecutionOutcome::FailedPermanent(WAL_ENTRY_NOT_FOUND_MESSAGE.to_string());
    };

    let now_seconds = current_time_seconds();
    wal_entry.status = WalStatus::InFlight;
    wal_entry.attempts = wal_entry.attempts.saturating_add(1);
    wal_entry.last_update_seconds = now_seconds;

    // Persist attempt start before await so retries survive traps/upgrades.
    put_entry(wal_entry.clone());

    let wal_kind = wal_entry.kind;
    let wal_attempt_number = wal_entry.attempts;

    let payload_execution_result = execute_wal_payload(operation_id, &wal_entry.payload).await;

    match payload_execution_result {
        Ok(wal_result) => {
            let mut updated_wal_entry = wal_entry;

            updated_wal_entry.status = WalStatus::Succeeded;
            updated_wal_entry.last_update_seconds = current_time_seconds();
            updated_wal_entry.last_err = None;
            updated_wal_entry.result = Some(wal_result);

            put_entry(updated_wal_entry);
            logging::log!(
                "wal succeeded operation_id={:?} kind={:?} attempts={}",
                operation_id,
                wal_kind,
                wal_attempt_number
            );
            WalExecutionOutcome::Succeeded
        }
        Err(WalExecutionError::Retryable(retryable_error_message)) => {
            let mut updated_wal_entry = wal_entry;

            updated_wal_entry.last_update_seconds = current_time_seconds();
            updated_wal_entry.last_err = Some(retryable_error_message.clone());

            updated_wal_entry.status = WalStatus::RecoveryRequired;
            updated_wal_entry.next_attempt_at_seconds = updated_wal_entry.last_update_seconds;
            put_entry(updated_wal_entry);
            logging::warn!(
                "wal recovery required operation_id={:?} kind={:?} attempts={} error={}",
                operation_id,
                wal_kind,
                wal_attempt_number,
                retryable_error_message
            );
            WalExecutionOutcome::RecoveryRequired(retryable_error_message)
        }
        Err(WalExecutionError::Permanent(permanent_error_message)) => {
            let wal_payload = wal_entry.payload.clone();
            let mut updated_wal_entry = wal_entry;

            updated_wal_entry.status = WalStatus::FailedPermanent;
            updated_wal_entry.last_update_seconds = current_time_seconds();
            updated_wal_entry.last_err = Some(permanent_error_message.clone());

            put_entry(updated_wal_entry);
            finalize_failed_wal_payload(&wal_payload, &permanent_error_message);
            logging::error!(
                "wal failed permanent operation_id={:?} kind={:?} attempts={} error={}",
                operation_id,
                wal_kind,
                wal_attempt_number,
                permanent_error_message
            );
            WalExecutionOutcome::FailedPermanent(permanent_error_message)
        }
    }
}

async fn execute_wal_payload(
    operation_id: OperationId,
    payload: &WalPayload,
) -> Result<WalResult, WalExecutionError> {
    match payload {
        WalPayload::Settlement(settlement_payload) => {
            run_settlement_wal(operation_id, settlement_payload)
                .await
                .map(WalResult::Settlement)
        }
        WalPayload::Withdrawal(withdrawal_payload) => {
            run_withdrawal_wal(operation_id, withdrawal_payload)
                .await
                .map(WalResult::Withdrawal)
        }
        WalPayload::Accept(accept_payload) => run_accept_wal(operation_id, accept_payload)
            .await
            .map(WalResult::Accept),
    }
}

fn finalize_failed_wal_payload(payload: &WalPayload, message: &str) {
    match payload {
        WalPayload::Accept(accept_payload) => finalize_failed_accept_wal(accept_payload, message),
        WalPayload::Withdrawal(withdrawal_payload) => {
            finalize_failed_withdrawal_wal(withdrawal_payload, message)
        }
        WalPayload::Settlement(settlement_payload) => {
            finalize_failed_settlement_wal(settlement_payload, message)
        }
    }
}

fn is_retryable_error(error: &VolumetricError) -> bool {
    if error.code != error_codes::INTER_CANISTER_CALL_FAILED.code {
        return false;
    }

    let lowercase_error_message = error.message.to_ascii_lowercase();
    RETRYABLE_INTER_CANISTER_ERROR_PATTERNS
        .iter()
        .any(|retryable_pattern| lowercase_error_message.contains(retryable_pattern))
}

#[cfg(test)]
mod tests {
    use candid::Principal;

    use super::*;
    use crate::ic::{self, IcRuntime};
    use crate::journaling::{default_policy, enqueue_if_absent, WalKind};
    use crate::usecases::{SettlementWalResult, WithdrawalWalResult};

    const TEST_NOW_NS: u64 = 1_000_000_000_000;

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

    fn make_operation_id(seed: u8) -> OperationId {
        OperationId::from_parts(&[b"executor-test", &[seed]])
    }

    fn make_withdrawal_payload(seed: u8) -> WalPayload {
        WalPayload::Withdrawal(super::super::types::WithdrawalWalPayload {
            withdrawal_id: u64::from(seed),
            principal: Principal::anonymous(),
            gross_withdraw_amount_sats: 100 + u64::from(seed),
            withdraw_amount_after_fees_sats: 100 + u64::from(seed),
            btc_address: format!("tb1qexecutor{seed}"),
            created_at_time_ns: TEST_NOW_NS,
        })
    }

    fn make_settlement_payload(seed: u8) -> WalPayload {
        WalPayload::Settlement(super::super::types::SettlementWalPayload {
            option_id: u64::from(seed),
            settlement_price_cents: 10_000_000 + u64::from(seed),
            created_at_time_ns: TEST_NOW_NS,
        })
    }

    fn reset_executor_inflight_state() {
        WAL_EXECUTION_IN_PROGRESS_OPERATION_IDS.with(|in_progress_operation_ids| {
            in_progress_operation_ids.borrow_mut().clear();
        });
    }

    /// Given: inter-canister and non-inter-canister errors
    /// When: registering WAL retry classification
    /// Then: known retryable patterns map to retryable and others map to permanent
    #[test]
    fn register_retryable_error_classifies_errors_by_message_and_code() {
        // given
        let retryable_error = VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some("Temporarily unavailable"),
            None,
        );
        let inter_canister_error_with_non_retryable_context = VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some("malformed address"),
            None,
        );
        let non_inter_canister_error =
            VolumetricError::from_def(error_codes::INSUFFICIENT_BALANCE, None, None);

        // when
        let retryable_classification = register_retryable_error(retryable_error);
        let inter_canister_classification =
            register_retryable_error(inter_canister_error_with_non_retryable_context);
        let non_inter_canister_classification = register_retryable_error(non_inter_canister_error);

        // then
        assert!(matches!(
            retryable_classification,
            WalExecutionError::Retryable(_)
        ));
        assert!(matches!(
            inter_canister_classification,
            WalExecutionError::Retryable(_)
        ));
        assert!(matches!(
            non_inter_canister_classification,
            WalExecutionError::Permanent(_)
        ));
    }

    /// Given: an operation id is already marked as in-flight
    /// When: a second in-flight mark is attempted
    /// Then: the second attempt is skipped to prevent concurrent WAL execution
    #[test]
    fn mark_wal_execution_in_progress_if_idle_prevents_duplicates() {
        // given
        reset_executor_inflight_state();
        let operation_id = make_operation_id(1);

        // when
        let first_mark_result = mark_wal_execution_in_progress_if_idle(operation_id);
        let second_mark_result = mark_wal_execution_in_progress_if_idle(operation_id);

        // then
        assert!(first_mark_result);
        assert!(!second_mark_result);

        reset_executor_inflight_state();
    }

    /// Given: no WAL entry exists for the requested operation id
    /// When: execute_wal_entry_now is called
    /// Then: it returns a permanent failure with not-found message
    #[tokio::test]
    async fn execute_wal_entry_now_missing_entry_returns_failed_permanent() {
        // given
        reset_executor_inflight_state();
        let operation_id = make_operation_id(200);

        // when
        let outcome = execute_wal_entry_now(operation_id).await;

        // then
        assert_eq!(
            outcome,
            WalExecutionOutcome::FailedPermanent(WAL_ENTRY_NOT_FOUND_MESSAGE.to_string())
        );
    }

    /// Given: a WAL entry is already in succeeded status
    /// When: execute_wal_entry_now is called again for the same operation id
    /// Then: execution returns SucceededAlready without re-running payload side effects
    #[tokio::test]
    async fn execute_wal_entry_now_returns_succeeded_already_for_terminal_entry() {
        // given
        reset_executor_inflight_state();
        ic::set_runtime(Box::new(MockRuntime));
        let operation_id = make_operation_id(2);
        enqueue_if_absent(
            operation_id,
            WalKind::Withdrawal,
            make_withdrawal_payload(2),
            default_policy(),
        );

        let mut wal_entry = get_entry(operation_id).expect("entry should exist");
        wal_entry.status = WalStatus::Succeeded;
        wal_entry.result = Some(WalResult::Withdrawal(WithdrawalWalResult {
            block_index: 42,
        }));
        put_entry(wal_entry);

        // when
        let outcome = execute_wal_entry_now(operation_id).await;

        // then
        assert_eq!(outcome, WalExecutionOutcome::SucceededAlready);
    }

    /// Given: a settlement WAL entry is already in succeeded status
    /// When: execute_wal_entry_now is called again for the same operation id
    /// Then: execution returns SucceededAlready without re-running settlement side effects
    #[tokio::test]
    async fn execute_wal_entry_now_returns_succeeded_already_for_terminal_settlement_entry() {
        // given
        reset_executor_inflight_state();
        ic::set_runtime(Box::new(MockRuntime));
        let operation_id = make_operation_id(3);
        enqueue_if_absent(
            operation_id,
            WalKind::Settlement,
            make_settlement_payload(3),
            default_policy(),
        );

        let mut wal_entry = get_entry(operation_id).expect("entry should exist");
        wal_entry.status = WalStatus::Succeeded;
        wal_entry.result = Some(WalResult::Settlement(SettlementWalResult { option_id: 3 }));
        put_entry(wal_entry);

        // when
        let outcome = execute_wal_entry_now(operation_id).await;

        // then
        assert_eq!(outcome, WalExecutionOutcome::SucceededAlready);
    }
}

use std::cell::RefCell;
use std::collections::BTreeSet;

use crate::errors::{error_codes, VolumetricError};
use crate::ic;
use crate::usecases::{run_accept_wal, run_settlement_wal, run_withdrawal_wal};

use super::super::OperationId;
use super::store::{due_ids, get_entry, put_entry};
use super::types::{DispatchError, RunOutcome, WalPayload, WalResult, WalStatus};

const MAX_WAL_RETRY_DELAY_SECS: u64 = 60 * 60;
const MAX_BACKOFF_EXPONENT: u32 = 10;
const NANOSECONDS_PER_SECOND: u64 = 1_000_000_000;
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
    static RUN_GUARDS: RefCell<BTreeSet<OperationId>> = const { RefCell::new(BTreeSet::new()) };
}

pub fn register_retryable_error(error: VolumetricError) -> DispatchError {
    if !is_retryable_error(&error) {
        DispatchError::Permanent(error.to_string())
    } else {
        DispatchError::Retryable(error.to_string())
    }
}

pub async fn execute_wal_entry_now(operation_id: OperationId) -> RunOutcome {
    let Some(existing_wal_entry) = get_entry(operation_id) else {
        return RunOutcome::FailedPermanent(WAL_ENTRY_NOT_FOUND_MESSAGE.to_string());
    };

    if existing_wal_entry.status == WalStatus::Succeeded {
        return RunOutcome::SucceededAlready;
    }

    if !try_acquire_run_guard(operation_id) {
        return RunOutcome::SkippedAlreadyInFlight;
    }

    let outcome = execute_wal_entry_attempt(operation_id).await;
    release_run_guard(operation_id);
    outcome
}

pub async fn retry_all_due() {
    let now_ns = ic::time();
    let retry_due_operation_ids = due_ids(now_ns);

    for operation_id in retry_due_operation_ids {
        let _ = execute_wal_entry_now(operation_id).await;
    }
}

fn try_acquire_run_guard(operation_id: OperationId) -> bool {
    RUN_GUARDS.with(|guards| {
        let mut guards = guards.borrow_mut();
        if guards.contains(&operation_id) {
            return false;
        }
        guards.insert(operation_id);
        true
    })
}

fn release_run_guard(operation_id: OperationId) {
    RUN_GUARDS.with(|guards| {
        guards.borrow_mut().remove(&operation_id);
    });
}

async fn execute_wal_entry_attempt(operation_id: OperationId) -> RunOutcome {
    let Some(mut wal_entry) = get_entry(operation_id) else {
        return RunOutcome::FailedPermanent(WAL_ENTRY_NOT_FOUND_MESSAGE.to_string());
    };

    let now_ns = ic::time();
    wal_entry.status = WalStatus::InFlight;
    wal_entry.attempts = wal_entry.attempts.saturating_add(1);
    wal_entry.last_update_ns = now_ns;

    // Persist attempt start before await so retries survive traps/upgrades.
    put_entry(wal_entry.clone());

    let payload_execution_result = execute_wal_payload(&wal_entry.payload).await;

    match payload_execution_result {
        Ok(wal_result) => {
            let mut updated_wal_entry = wal_entry;

            updated_wal_entry.status = WalStatus::Succeeded;
            updated_wal_entry.last_update_ns = ic::time();
            updated_wal_entry.last_err = None;
            updated_wal_entry.result = Some(wal_result);

            put_entry(updated_wal_entry);
            RunOutcome::Succeeded
        }
        Err(DispatchError::Retryable(retryable_error_message)) => {
            let mut updated_wal_entry = wal_entry;

            updated_wal_entry.last_update_ns = ic::time();
            updated_wal_entry.last_err = Some(retryable_error_message.clone());

            if updated_wal_entry.attempts >= updated_wal_entry.max_retries {
                updated_wal_entry.status = WalStatus::FailedPermanent;

                put_entry(updated_wal_entry);
                return RunOutcome::FailedPermanent(retryable_error_message);
            }

            updated_wal_entry.status = WalStatus::FailedRetryable;

            updated_wal_entry.next_attempt_at_ns = compute_next_attempt_at_ns(
                updated_wal_entry.last_update_ns,
                updated_wal_entry.backoff_secs,
                updated_wal_entry.attempts,
            );

            put_entry(updated_wal_entry);

            RunOutcome::FailedRetryable(retryable_error_message)
        }
        Err(DispatchError::Permanent(permanent_error_message)) => {
            let mut updated_wal_entry = wal_entry;

            updated_wal_entry.status = WalStatus::FailedPermanent;
            updated_wal_entry.last_update_ns = ic::time();
            updated_wal_entry.last_err = Some(permanent_error_message.clone());

            put_entry(updated_wal_entry);
            RunOutcome::FailedPermanent(permanent_error_message)
        }
    }
}

async fn execute_wal_payload(payload: &WalPayload) -> Result<WalResult, DispatchError> {
    match payload {
        WalPayload::Settlement(settlement_payload) => run_settlement_wal(settlement_payload)
            .await
            .map(WalResult::Settlement),
        WalPayload::Withdrawal(withdrawal_payload) => run_withdrawal_wal(withdrawal_payload)
            .await
            .map(WalResult::Withdrawal),
        WalPayload::Accept(accept_payload) => {
            run_accept_wal(accept_payload).await.map(WalResult::Accept)
        }
    }
}

fn compute_next_attempt_at_ns(now_ns: u64, backoff_secs: u64, attempts: u32) -> u64 {
    let exponent = attempts.saturating_sub(1).min(MAX_BACKOFF_EXPONENT);
    let multiplier = 1u64 << exponent;
    let delay_secs = backoff_secs
        .saturating_mul(multiplier)
        .min(MAX_WAL_RETRY_DELAY_SECS);
    now_ns.saturating_add(delay_secs.saturating_mul(NANOSECONDS_PER_SECOND))
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

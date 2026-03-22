use std::cell::RefCell;
use std::collections::BTreeSet;
#[cfg(target_arch = "wasm32")]
use std::time::Duration;

use scopeguard::guard;

use crate::errors::{error_codes, VolumetricError};
use crate::ic;
use crate::usecases::{
    finalize_failed_accept_wal, finalize_failed_withdrawal_wal, run_accept_wal, run_settlement_wal,
    run_withdrawal_wal,
};

use super::super::OperationId;
use super::store::{due_ids, get_entry, put_entry};
use super::types::{WalExecutionError, WalExecutionOutcome, WalPayload, WalResult, WalStatus};

const MAX_WAL_RETRY_DELAY_SECS: u64 = 60 * 60;
const MAX_BACKOFF_EXPONENT: u32 = 10;
const NANOSECONDS_PER_SECOND: u64 = 1_000_000_000;
const WAL_RETRY_BATCH_LIMIT: usize = 30;
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
    static RETRY_SCAN_IN_PROGRESS: RefCell<bool> = const { RefCell::new(false) };
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

pub async fn retry_all_due() {
    if !mark_retry_scan_in_progress_if_idle() {
        return;
    }

    let _retry_scan_guard = guard((), |_| {
        RETRY_SCAN_IN_PROGRESS.with(|is_in_progress| {
            *is_in_progress.borrow_mut() = false;
        });
    });

    let now_ns = ic::time();
    let retry_due_operation_ids = due_ids(now_ns, WAL_RETRY_BATCH_LIMIT);

    for operation_id in retry_due_operation_ids {
        let _ = execute_wal_entry_now(operation_id).await;
    }
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

fn mark_retry_scan_in_progress_if_idle() -> bool {
    RETRY_SCAN_IN_PROGRESS.with(|is_in_progress| {
        let mut is_in_progress = is_in_progress.borrow_mut();
        if *is_in_progress {
            return false;
        }

        *is_in_progress = true;
        true
    })
}

async fn execute_wal_entry_attempt(operation_id: OperationId) -> WalExecutionOutcome {
    let Some(mut wal_entry) = get_entry(operation_id) else {
        return WalExecutionOutcome::FailedPermanent(WAL_ENTRY_NOT_FOUND_MESSAGE.to_string());
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
            WalExecutionOutcome::Succeeded
        }
        Err(WalExecutionError::Retryable(retryable_error_message)) => {
            let wal_payload = wal_entry.payload.clone();
            let mut updated_wal_entry = wal_entry;

            updated_wal_entry.last_update_ns = ic::time();
            updated_wal_entry.last_err = Some(retryable_error_message.clone());

            if updated_wal_entry.attempts >= updated_wal_entry.max_retries {
                updated_wal_entry.status = WalStatus::FailedPermanent;

                put_entry(updated_wal_entry);
                finalize_failed_wal_payload(&wal_payload, &retryable_error_message);
                return WalExecutionOutcome::FailedPermanent(retryable_error_message);
            }

            updated_wal_entry.status = WalStatus::FailedRetryable;

            updated_wal_entry.next_attempt_at_ns = compute_next_attempt_at_ns(
                updated_wal_entry.last_update_ns,
                updated_wal_entry.backoff_secs,
                updated_wal_entry.attempts,
            );
            let retry_delay_ns = updated_wal_entry
                .next_attempt_at_ns
                .saturating_sub(updated_wal_entry.last_update_ns);

            put_entry(updated_wal_entry);
            schedule_retry_nudge(retry_delay_ns);

            WalExecutionOutcome::FailedRetryable(retryable_error_message)
        }
        Err(WalExecutionError::Permanent(permanent_error_message)) => {
            let wal_payload = wal_entry.payload.clone();
            let mut updated_wal_entry = wal_entry;

            updated_wal_entry.status = WalStatus::FailedPermanent;
            updated_wal_entry.last_update_ns = ic::time();
            updated_wal_entry.last_err = Some(permanent_error_message.clone());

            put_entry(updated_wal_entry);
            finalize_failed_wal_payload(&wal_payload, &permanent_error_message);
            WalExecutionOutcome::FailedPermanent(permanent_error_message)
        }
    }
}

async fn execute_wal_payload(payload: &WalPayload) -> Result<WalResult, WalExecutionError> {
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

fn finalize_failed_wal_payload(payload: &WalPayload, message: &str) {
    match payload {
        WalPayload::Accept(accept_payload) => finalize_failed_accept_wal(accept_payload, message),
        WalPayload::Withdrawal(withdrawal_payload) => {
            finalize_failed_withdrawal_wal(withdrawal_payload, message)
        }
        WalPayload::Settlement(_) => {}
    }
}

#[cfg(target_arch = "wasm32")]
fn schedule_retry_nudge(delay_ns: u64) {
    let delay_seconds =
        delay_ns.saturating_add(NANOSECONDS_PER_SECOND.saturating_sub(1)) / NANOSECONDS_PER_SECOND;
    let clamped_delay_seconds = delay_seconds.clamp(1, MAX_WAL_RETRY_DELAY_SECS);

    ic_cdk_timers::set_timer(Duration::from_secs(clamped_delay_seconds), async move {
        retry_all_due().await;
    });
}

#[cfg(not(target_arch = "wasm32"))]
fn schedule_retry_nudge(_delay_ns: u64) {}

fn is_retryable_error(error: &VolumetricError) -> bool {
    if error.code != error_codes::INTER_CANISTER_CALL_FAILED.code {
        return false;
    }

    let lowercase_error_message = error.message.to_ascii_lowercase();
    RETRYABLE_INTER_CANISTER_ERROR_PATTERNS
        .iter()
        .any(|retryable_pattern| lowercase_error_message.contains(retryable_pattern))
}

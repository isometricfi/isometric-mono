use std::cell::RefCell;

use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::StableBTreeMap;

use crate::storage::{Cbor, Memory, MemoryIndex, MEMORY_MANAGER};
use crate::time::current_time_seconds;

use super::super::OperationId;
use super::types::{WalEntry, WalKind, WalPayload, WalPolicy, WalStatus};

const SUCCEEDED_WAL_ENTRY_RETENTION_24_HOURS_SECS: u64 = 24 * 60 * 60;
const STALE_IN_FLIGHT_RETRY_TIMEOUT_15_MINUTES_SECS: u64 = 15 * 60;
const WAL_RETRY_CREATED_AT_MAX_AGE_23_HOURS_SECS: u64 = 23 * 60 * 60;
const STALE_IN_FLIGHT_MANUAL_RECOVERY_MESSAGE: &str =
    "stale in-flight WAL execution requires manual recovery";
const RETRY_EXHAUSTED_MANUAL_RECOVERY_MESSAGE: &str = "WAL automatic retry attempts exhausted";
const RETRY_TOO_OLD_MANUAL_RECOVERY_MESSAGE: &str =
    "WAL automatic retry window expired before ledger deduplication window";

pub struct WalRetryDrain {
    pub operation_ids: Vec<OperationId>,
    pub promoted_to_recovery_required: u64,
}

thread_local! {
    static WAL: RefCell<StableBTreeMap<OperationId, Cbor<WalEntry>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::WalMemory as u8))),
        )
    );
}

pub fn default_policy() -> WalPolicy {
    WalPolicy {
        max_retries: 100,
        backoff_secs: 5,
    }
}

pub fn enqueue_if_absent(
    operation_id: OperationId,
    kind: WalKind,
    payload: WalPayload,
    policy: WalPolicy,
) -> OperationId {
    let now_seconds = current_time_seconds();
    WAL.with_borrow_mut(|wal| {
        if let Some(existing_wal_entry) = wal.get(&operation_id).map(|entry| entry.0) {
            if existing_wal_entry.kind != kind || existing_wal_entry.payload != payload {
                panic!(
                    "WAL enqueue conflict for operation_id={:?} existing_kind={:?} new_kind={:?}",
                    operation_id, existing_wal_entry.kind, kind
                );
            }

            return;
        }

        wal.insert(
            operation_id,
            Cbor(WalEntry {
                id: operation_id,
                kind,
                attempts: 0,
                status: WalStatus::Enqueued,
                first_seen_seconds: now_seconds,
                last_update_seconds: now_seconds,
                last_err: None,
                payload,
                max_retries: policy.max_retries,
                backoff_secs: policy.backoff_secs,
                next_attempt_at_seconds: now_seconds,
                result: None,
            }),
        );
    });

    operation_id
}

pub fn get_entry(operation_id: OperationId) -> Option<WalEntry> {
    WAL.with_borrow(|wal| wal.get(&operation_id).map(|entry| entry.0))
}

pub fn list_entries_by_status(status: WalStatus, limit: usize) -> Vec<WalEntry> {
    if limit == 0 {
        return Vec::new();
    }

    WAL.with_borrow(|wal| {
        wal.iter()
            .filter_map(|entry| {
                let wal_entry = entry.value().0;
                if wal_entry.status == status {
                    Some(wal_entry)
                } else {
                    None
                }
            })
            .take(limit)
            .collect()
    })
}

pub fn collect_due_retry_required_operation_ids(limit: usize) -> WalRetryDrain {
    if limit == 0 {
        return WalRetryDrain {
            operation_ids: Vec::new(),
            promoted_to_recovery_required: 0,
        };
    }

    let now_seconds = current_time_seconds();
    WAL.with_borrow_mut(|wal| {
        let mut operation_ids = Vec::with_capacity(limit);
        let mut promoted_to_recovery_required: u64 = 0;
        let retry_operation_ids: Vec<OperationId> = wal
            .iter()
            .filter_map(|entry| {
                let wal_entry = entry.value().0;
                if wal_entry.status == WalStatus::RetryRequired {
                    Some(*entry.key())
                } else {
                    None
                }
            })
            .collect();

        for operation_id in retry_operation_ids {
            let Some(mut wal_entry) = wal.get(&operation_id).map(|entry| entry.0) else {
                continue;
            };

            if wal_entry.status != WalStatus::RetryRequired {
                continue;
            }

            if should_retry_required_entry_move_to_recovery(&wal_entry, now_seconds) {
                wal_entry.status = WalStatus::RecoveryRequired;
                wal_entry.last_update_seconds = now_seconds;
                wal_entry.last_err = Some(manual_recovery_reason(&wal_entry, now_seconds));
                wal.insert(operation_id, Cbor(wal_entry));
                promoted_to_recovery_required = promoted_to_recovery_required.saturating_add(1);
                continue;
            }

            if operation_ids.len() >= limit || wal_entry.next_attempt_at_seconds > now_seconds {
                continue;
            }

            operation_ids.push(operation_id);
        }

        WalRetryDrain {
            operation_ids,
            promoted_to_recovery_required,
        }
    })
}

pub fn promote_stale_in_flight_to_recovery_required() -> u64 {
    let now_seconds = current_time_seconds();
    let stale_deadline_seconds =
        now_seconds.saturating_sub(STALE_IN_FLIGHT_RETRY_TIMEOUT_15_MINUTES_SECS);

    WAL.with_borrow_mut(|wal| {
        let stale_operation_ids: Vec<OperationId> = wal
            .iter()
            .filter_map(|entry| {
                let wal_entry = entry.value().0;
                if wal_entry.status == WalStatus::InFlight
                    && wal_entry.last_update_seconds <= stale_deadline_seconds
                {
                    Some(*entry.key())
                } else {
                    None
                }
            })
            .collect();

        let mut promoted_count: u64 = 0;
        for operation_id in stale_operation_ids {
            if let Some(mut wal_entry) = wal.get(&operation_id).map(|entry| entry.0) {
                if wal_entry.status != WalStatus::InFlight
                    || wal_entry.last_update_seconds > stale_deadline_seconds
                {
                    continue;
                }

                wal_entry.status = stale_in_flight_target_status(wal_entry.kind);
                wal_entry.last_update_seconds = now_seconds;
                wal_entry.next_attempt_at_seconds = now_seconds;
                if wal_entry.last_err.is_none() {
                    wal_entry.last_err = Some(stale_in_flight_message(wal_entry.kind));
                }
                wal.insert(operation_id, Cbor(wal_entry));
                promoted_count = promoted_count.saturating_add(1);
            }
        }

        promoted_count
    })
}

pub fn is_auto_retryable_wal_kind(kind: WalKind) -> bool {
    matches!(kind, WalKind::Accept | WalKind::Settlement)
}

pub fn cleanup_succeeded() -> u64 {
    let now_seconds = current_time_seconds();
    WAL.with_borrow_mut(|wal| {
        let cutoff_seconds =
            now_seconds.saturating_sub(SUCCEEDED_WAL_ENTRY_RETENTION_24_HOURS_SECS);
        let keys_to_remove: Vec<OperationId> = wal
            .iter()
            .filter_map(|entry| {
                let wal_entry = entry.value().0;

                if wal_entry.status == WalStatus::Succeeded
                    && wal_entry.last_update_seconds <= cutoff_seconds
                {
                    Some(*entry.key())
                } else {
                    None
                }
            })
            .collect();

        let removed_count = keys_to_remove.len() as u64;
        for key in keys_to_remove {
            wal.remove(&key);
        }
        removed_count
    })
}

pub(super) fn put_entry(entry: WalEntry) {
    WAL.with_borrow_mut(|wal| {
        wal.insert(entry.id, Cbor(entry));
    });
}

fn stale_in_flight_target_status(kind: WalKind) -> WalStatus {
    if is_auto_retryable_wal_kind(kind) {
        WalStatus::RetryRequired
    } else {
        WalStatus::RecoveryRequired
    }
}

fn stale_in_flight_message(kind: WalKind) -> String {
    if is_auto_retryable_wal_kind(kind) {
        "stale in-flight WAL execution queued for automatic retry".to_string()
    } else {
        STALE_IN_FLIGHT_MANUAL_RECOVERY_MESSAGE.to_string()
    }
}

fn should_retry_required_entry_move_to_recovery(wal_entry: &WalEntry, now_seconds: u64) -> bool {
    wal_entry.attempts >= wal_entry.max_retries
        || wal_entry_created_at_seconds(wal_entry).is_some_and(|created_at_seconds| {
            retry_created_at_is_too_old(created_at_seconds, now_seconds)
        })
}

fn manual_recovery_reason(wal_entry: &WalEntry, now_seconds: u64) -> String {
    if wal_entry.attempts >= wal_entry.max_retries {
        return RETRY_EXHAUSTED_MANUAL_RECOVERY_MESSAGE.to_string();
    }

    if wal_entry_created_at_seconds(wal_entry).is_some_and(|created_at_seconds| {
        retry_created_at_is_too_old(created_at_seconds, now_seconds)
    }) {
        return RETRY_TOO_OLD_MANUAL_RECOVERY_MESSAGE.to_string();
    }

    STALE_IN_FLIGHT_MANUAL_RECOVERY_MESSAGE.to_string()
}

fn wal_entry_created_at_seconds(wal_entry: &WalEntry) -> Option<u64> {
    let created_at_time_ns = match &wal_entry.payload {
        WalPayload::Settlement(payload) => payload.created_at_time_ns,
        WalPayload::Accept(payload) => payload.created_at_time_ns,
        WalPayload::Withdrawal(_) => return None,
    };

    Some(created_at_time_ns / crate::time::NANOS_PER_SECOND)
}

fn retry_created_at_is_too_old(created_at_seconds: u64, now_seconds: u64) -> bool {
    created_at_seconds <= now_seconds.saturating_sub(WAL_RETRY_CREATED_AT_MAX_AGE_23_HOURS_SECS)
}

#[cfg(test)]
mod tests {
    use candid::Principal;

    use super::*;
    use crate::ic::{self, IcRuntime};

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const TEST_NOW_SECONDS: u64 = TEST_NOW_NS / crate::time::NANOS_PER_SECOND;

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

    struct RuntimeAt {
        now_ns: u64,
    }

    impl IcRuntime for RuntimeAt {
        fn time(&self) -> u64 {
            self.now_ns
        }

        fn canister_self(&self) -> Principal {
            Principal::anonymous()
        }

        fn log(&self, _message: &str) {}
    }

    fn reset_wal_for_test() {
        ic::set_runtime(Box::new(MockRuntime));
        WAL.with_borrow_mut(|wal| {
            let operation_ids_to_remove: Vec<OperationId> =
                wal.iter().map(|entry| *entry.key()).collect();

            for operation_id in operation_ids_to_remove {
                wal.remove(&operation_id);
            }
        });
    }

    fn make_operation_id(seed: u8) -> OperationId {
        OperationId::from_parts(&[b"test", &[seed]])
    }

    fn make_withdrawal_payload(seed: u8) -> WalPayload {
        WalPayload::Withdrawal(super::super::types::WithdrawalWalPayload {
            withdrawal_id: u64::from(seed),
            principal: Principal::anonymous(),
            gross_withdraw_amount_sats: 100 + u64::from(seed),
            withdraw_amount_after_fees_sats: 100 + u64::from(seed),
            btc_address: format!("tb1q{seed}"),
            created_at_time_ns: TEST_NOW_NS,
        })
    }

    fn make_settlement_payload(seed: u8, created_at_time_ns: u64) -> WalPayload {
        WalPayload::Settlement(super::super::types::SettlementWalPayload {
            option_id: u64::from(seed),
            settlement_price_cents: 10_000_000 + u64::from(seed),
            created_at_time_ns,
            transfer_fee_sats: 10,
        })
    }

    fn make_accept_payload(seed: u8, created_at_time_ns: u64) -> WalPayload {
        WalPayload::Accept(super::super::types::AcceptWalPayload {
            accept_journal_entry_id: u64::from(seed),
            buyer: Principal::from_slice(&[seed; 29]),
            fill_group_id: u64::from(seed),
            total_buyer_debit_required_sats: 100,
            planned_platform_fee_sats: 1,
            transfer_fee_sats: 10,
            created_at_time_ns,
            prepared_accepts: Vec::new(),
            writer_transfers: Vec::new(),
        })
    }

    /// Given: an existing WAL entry for an operation id
    /// When: enqueueing the same operation id with a different payload
    /// Then: the WAL rejects the conflicting duplicate
    #[test]
    #[should_panic(expected = "WAL enqueue conflict")]
    fn enqueue_if_absent_panics_on_conflicting_duplicate_payload() {
        // given
        reset_wal_for_test();
        let operation_id = make_operation_id(1);
        let first_payload = make_withdrawal_payload(1);
        let conflicting_payload = make_withdrawal_payload(2);

        enqueue_if_absent(
            operation_id,
            WalKind::Withdrawal,
            first_payload,
            default_policy(),
        );

        // when
        enqueue_if_absent(
            operation_id,
            WalKind::Withdrawal,
            conflicting_payload,
            default_policy(),
        );
    }

    /// Given: stale and fresh in-flight WAL entries
    /// When: promoting stale in-flight entries
    /// Then: accept and settlement entries become retry-required while withdrawal stays recovery-required
    #[test]
    fn promote_stale_in_flight_to_recovery_required_promotes_by_wal_kind() {
        // given
        reset_wal_for_test();
        let stale_accept_operation_id = make_operation_id(30);
        let stale_withdrawal_operation_id = make_operation_id(31);
        let fresh_operation_id = make_operation_id(32);
        let stale_last_update_seconds =
            TEST_NOW_SECONDS.saturating_sub(STALE_IN_FLIGHT_RETRY_TIMEOUT_15_MINUTES_SECS);
        let fresh_last_update_seconds =
            TEST_NOW_SECONDS.saturating_sub(STALE_IN_FLIGHT_RETRY_TIMEOUT_15_MINUTES_SECS - 1);

        put_entry(WalEntry {
            id: stale_accept_operation_id,
            kind: WalKind::Accept,
            attempts: 1,
            status: WalStatus::InFlight,
            first_seen_seconds: TEST_NOW_SECONDS,
            last_update_seconds: stale_last_update_seconds,
            last_err: None,
            payload: make_accept_payload(30, TEST_NOW_NS),
            max_retries: 20,
            backoff_secs: 5,
            next_attempt_at_seconds: TEST_NOW_SECONDS.saturating_add(1),
            result: None,
        });

        put_entry(WalEntry {
            id: stale_withdrawal_operation_id,
            kind: WalKind::Withdrawal,
            attempts: 1,
            status: WalStatus::InFlight,
            first_seen_seconds: TEST_NOW_SECONDS,
            last_update_seconds: stale_last_update_seconds,
            last_err: None,
            payload: make_withdrawal_payload(31),
            max_retries: 20,
            backoff_secs: 5,
            next_attempt_at_seconds: TEST_NOW_SECONDS.saturating_add(1),
            result: None,
        });

        put_entry(WalEntry {
            id: fresh_operation_id,
            kind: WalKind::Withdrawal,
            attempts: 1,
            status: WalStatus::InFlight,
            first_seen_seconds: TEST_NOW_SECONDS,
            last_update_seconds: fresh_last_update_seconds,
            last_err: None,
            payload: make_withdrawal_payload(32),
            max_retries: 20,
            backoff_secs: 5,
            next_attempt_at_seconds: TEST_NOW_SECONDS.saturating_add(1),
            result: None,
        });

        // when
        let promoted_count = promote_stale_in_flight_to_recovery_required();
        let stale_accept_entry =
            get_entry(stale_accept_operation_id).expect("stale accept entry should exist");
        let stale_withdrawal_entry =
            get_entry(stale_withdrawal_operation_id).expect("stale withdrawal entry should exist");
        let fresh_entry = get_entry(fresh_operation_id).expect("fresh entry should exist");

        // then
        assert_eq!(promoted_count, 2);
        assert_eq!(stale_accept_entry.status, WalStatus::RetryRequired);
        assert!(stale_accept_entry
            .last_err
            .is_some_and(|message| !message.trim().is_empty()));
        assert_eq!(stale_withdrawal_entry.status, WalStatus::RecoveryRequired);
        assert!(stale_withdrawal_entry
            .last_err
            .is_some_and(|message| !message.trim().is_empty()));
        assert_eq!(fresh_entry.status, WalStatus::InFlight);
    }

    /// Given: due, future, exhausted, and too-old retry-required WAL entries
    /// When: collecting entries for automatic retry
    /// Then: only due entries are returned and unsafe entries move to manual recovery
    #[test]
    fn collect_due_retry_required_operation_ids_filters_and_promotes_unsafe_entries() {
        // given
        reset_wal_for_test();
        const TEST_LATE_NOW_NS: u64 = TEST_NOW_NS + 24 * 60 * 60 * crate::time::NANOS_PER_SECOND;
        const TEST_LATE_NOW_SECONDS: u64 = TEST_LATE_NOW_NS / crate::time::NANOS_PER_SECOND;
        let due_operation_id = make_operation_id(40);
        let future_operation_id = make_operation_id(41);
        let exhausted_operation_id = make_operation_id(42);
        let too_old_operation_id = make_operation_id(43);

        ic::set_runtime(Box::new(RuntimeAt {
            now_ns: TEST_LATE_NOW_NS,
        }));

        put_entry(WalEntry {
            id: due_operation_id,
            kind: WalKind::Settlement,
            attempts: 1,
            status: WalStatus::RetryRequired,
            first_seen_seconds: TEST_LATE_NOW_SECONDS,
            last_update_seconds: TEST_LATE_NOW_SECONDS,
            last_err: Some("temporarily unavailable".to_string()),
            payload: make_settlement_payload(40, TEST_LATE_NOW_NS),
            max_retries: 20,
            backoff_secs: 5,
            next_attempt_at_seconds: TEST_LATE_NOW_SECONDS,
            result: None,
        });

        put_entry(WalEntry {
            id: future_operation_id,
            kind: WalKind::Settlement,
            attempts: 1,
            status: WalStatus::RetryRequired,
            first_seen_seconds: TEST_LATE_NOW_SECONDS,
            last_update_seconds: TEST_LATE_NOW_SECONDS,
            last_err: Some("temporarily unavailable".to_string()),
            payload: make_settlement_payload(41, TEST_LATE_NOW_NS),
            max_retries: 20,
            backoff_secs: 5,
            next_attempt_at_seconds: TEST_LATE_NOW_SECONDS.saturating_add(1),
            result: None,
        });

        put_entry(WalEntry {
            id: exhausted_operation_id,
            kind: WalKind::Settlement,
            attempts: 20,
            status: WalStatus::RetryRequired,
            first_seen_seconds: TEST_LATE_NOW_SECONDS,
            last_update_seconds: TEST_LATE_NOW_SECONDS,
            last_err: None,
            payload: make_settlement_payload(42, TEST_LATE_NOW_NS),
            max_retries: 20,
            backoff_secs: 5,
            next_attempt_at_seconds: TEST_LATE_NOW_SECONDS,
            result: None,
        });

        put_entry(WalEntry {
            id: too_old_operation_id,
            kind: WalKind::Accept,
            attempts: 1,
            status: WalStatus::RetryRequired,
            first_seen_seconds: TEST_LATE_NOW_SECONDS,
            last_update_seconds: TEST_LATE_NOW_SECONDS,
            last_err: None,
            payload: make_accept_payload(43, TEST_NOW_NS),
            max_retries: 20,
            backoff_secs: 5,
            next_attempt_at_seconds: TEST_LATE_NOW_SECONDS,
            result: None,
        });

        // when
        let retry_drain = collect_due_retry_required_operation_ids(10);
        let future_entry = get_entry(future_operation_id).expect("future entry should exist");
        let exhausted_entry =
            get_entry(exhausted_operation_id).expect("exhausted entry should exist");
        let too_old_entry = get_entry(too_old_operation_id).expect("too-old entry should exist");

        // then
        assert_eq!(retry_drain.operation_ids, vec![due_operation_id]);
        assert_eq!(retry_drain.promoted_to_recovery_required, 2);
        assert_eq!(future_entry.status, WalStatus::RetryRequired);
        assert_eq!(exhausted_entry.status, WalStatus::RecoveryRequired);
        assert_eq!(too_old_entry.status, WalStatus::RecoveryRequired);
    }
}

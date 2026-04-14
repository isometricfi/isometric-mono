use std::cell::RefCell;

use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::StableBTreeMap;

use crate::ic;
use crate::storage::{Cbor, Memory, MemoryIndex, MEMORY_MANAGER};

use super::super::OperationId;
use super::types::{WalEntry, WalKind, WalPayload, WalPolicy, WalStatus};

const SUCCEEDED_WAL_ENTRY_RETENTION_24_HOURS_SECS: u64 = 24 * 60 * 60;
const STALE_IN_FLIGHT_RETRY_TIMEOUT_15_MINUTES_SECS: u64 = 15 * 60;
const NANOSECONDS_PER_SECOND: u64 = 1_000_000_000;

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
    let now_ns = ic::time();
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
                first_seen_ns: now_ns,
                last_update_ns: now_ns,
                last_err: None,
                payload,
                max_retries: policy.max_retries,
                backoff_secs: policy.backoff_secs,
                next_attempt_at_ns: now_ns,
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

pub fn promote_stale_in_flight_to_recovery_required() -> u64 {
    let now_ns = ic::time();
    let stale_after_ns =
        STALE_IN_FLIGHT_RETRY_TIMEOUT_15_MINUTES_SECS.saturating_mul(NANOSECONDS_PER_SECOND);
    let stale_deadline_ns = now_ns.saturating_sub(stale_after_ns);

    WAL.with_borrow_mut(|wal| {
        let stale_operation_ids: Vec<OperationId> = wal
            .iter()
            .filter_map(|entry| {
                let wal_entry = entry.value().0;
                if wal_entry.status == WalStatus::InFlight
                    && wal_entry.last_update_ns <= stale_deadline_ns
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
                    || wal_entry.last_update_ns > stale_deadline_ns
                {
                    continue;
                }

                wal_entry.status = WalStatus::RecoveryRequired;
                wal_entry.last_update_ns = now_ns;
                wal_entry.next_attempt_at_ns = now_ns;
                if wal_entry.last_err.is_none() {
                    wal_entry.last_err =
                        Some("stale in-flight WAL execution requires manual recovery".to_string());
                }
                wal.insert(operation_id, Cbor(wal_entry));
                promoted_count = promoted_count.saturating_add(1);
            }
        }

        promoted_count
    })
}

pub fn cleanup_succeeded() -> u64 {
    let now_ns = ic::time();
    WAL.with_borrow_mut(|wal| {
        let cutoff_ns = now_ns
            .saturating_sub(SUCCEEDED_WAL_ENTRY_RETENTION_24_HOURS_SECS * NANOSECONDS_PER_SECOND);
        let keys_to_remove: Vec<OperationId> = wal
            .iter()
            .filter_map(|entry| {
                let wal_entry = entry.value().0;

                if wal_entry.status == WalStatus::Succeeded && wal_entry.last_update_ns <= cutoff_ns
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

#[cfg(test)]
mod tests {
    use candid::Principal;

    use super::*;
    use crate::ic::{self, IcRuntime};

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
            amount_sats: 100 + u64::from(seed),
            net_ckbtc_transfer_amount_sats: Some(100 + u64::from(seed)),
            btc_address: format!("tb1q{seed}"),
            created_at_time_ns: TEST_NOW_NS,
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
    /// When: promoting stale in-flight entries to recovery-required
    /// Then: stale entries become recovery-required while fresh entries stay in-flight
    #[test]
    fn promote_stale_in_flight_to_recovery_required_promotes_only_stale_entries() {
        // given
        reset_wal_for_test();
        let stale_operation_id = make_operation_id(31);
        let fresh_operation_id = make_operation_id(32);
        let stale_after_ns =
            STALE_IN_FLIGHT_RETRY_TIMEOUT_15_MINUTES_SECS.saturating_mul(NANOSECONDS_PER_SECOND);
        let stale_last_update_ns = TEST_NOW_NS.saturating_sub(stale_after_ns);
        let fresh_last_update_ns = TEST_NOW_NS.saturating_sub(stale_after_ns.saturating_sub(1));

        put_entry(WalEntry {
            id: stale_operation_id,
            kind: WalKind::Withdrawal,
            attempts: 1,
            status: WalStatus::InFlight,
            first_seen_ns: TEST_NOW_NS,
            last_update_ns: stale_last_update_ns,
            last_err: None,
            payload: make_withdrawal_payload(31),
            max_retries: 20,
            backoff_secs: 5,
            next_attempt_at_ns: TEST_NOW_NS.saturating_add(1_000),
            result: None,
        });

        put_entry(WalEntry {
            id: fresh_operation_id,
            kind: WalKind::Withdrawal,
            attempts: 1,
            status: WalStatus::InFlight,
            first_seen_ns: TEST_NOW_NS,
            last_update_ns: fresh_last_update_ns,
            last_err: None,
            payload: make_withdrawal_payload(32),
            max_retries: 20,
            backoff_secs: 5,
            next_attempt_at_ns: TEST_NOW_NS.saturating_add(1_000),
            result: None,
        });

        // when
        let promoted_count = promote_stale_in_flight_to_recovery_required();
        let stale_entry = get_entry(stale_operation_id).expect("stale entry should exist");
        let fresh_entry = get_entry(fresh_operation_id).expect("fresh entry should exist");

        // then
        assert_eq!(promoted_count, 1);
        assert_eq!(stale_entry.status, WalStatus::RecoveryRequired);
        assert!(stale_entry
            .last_err
            .is_some_and(|message| !message.trim().is_empty()));
        assert_eq!(fresh_entry.status, WalStatus::InFlight);
    }
}

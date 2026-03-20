use std::cell::RefCell;

use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::StableBTreeMap;

use crate::ic;
use crate::storage::{Cbor, Memory, MemoryIndex, MEMORY_MANAGER};

use super::super::OperationId;
use super::types::{WalEntry, WalKind, WalPayload, WalPolicy, WalStatus};

const SUCCEEDED_RETENTION_SECS: u64 = 24 * 60 * 60;

thread_local! {
    static WAL: RefCell<StableBTreeMap<OperationId, Cbor<WalEntry>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::WalMemory as u8))),
        )
    );
}

pub fn default_policy() -> WalPolicy {
    WalPolicy {
        max_retries: 20,
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

pub fn cleanup_succeeded() -> u64 {
    let now_ns = ic::time();
    WAL.with_borrow_mut(|wal| {
        let cutoff_ns = now_ns.saturating_sub(SUCCEEDED_RETENTION_SECS * 1_000_000_000);
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

pub(super) fn due_ids(now_ns: u64, limit: usize) -> Vec<OperationId> {
    if limit == 0 {
        return Vec::new();
    }

    WAL.with_borrow(|wal| {
        wal.iter()
            .filter_map(|entry| {
                let wal_entry = entry.value().0;
                if is_actionable(&wal_entry, now_ns) {
                    Some(*entry.key())
                } else {
                    None
                }
            })
            .take(limit)
            .collect()
    })
}

fn is_actionable(entry: &WalEntry, now_ns: u64) -> bool {
    matches!(
        entry.status,
        WalStatus::Enqueued | WalStatus::FailedRetryable
    ) && entry.next_attempt_at_ns <= now_ns
}

#[cfg(test)]
mod tests {
    use candid::Principal;

    use super::*;
    use crate::ic::{self, IcRuntime};
    use crate::usecases::WithdrawalWalResult;

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

    /// Given: more due WAL entries than the retry batch limit
    /// When: collecting due operation ids
    /// Then: only the requested number of ids is returned
    #[test]
    fn due_ids_respects_limit() {
        // given
        reset_wal_for_test();
        const DUE_ENTRY_COUNT: u8 = 3;
        const DUE_LIMIT: usize = 2;

        for seed in 0..DUE_ENTRY_COUNT {
            let operation_id = make_operation_id(seed);
            put_entry(WalEntry {
                id: operation_id,
                kind: WalKind::Withdrawal,
                attempts: 0,
                status: WalStatus::FailedRetryable,
                first_seen_ns: TEST_NOW_NS,
                last_update_ns: TEST_NOW_NS,
                last_err: Some("retry me".to_string()),
                payload: make_withdrawal_payload(seed),
                max_retries: 20,
                backoff_secs: 5,
                next_attempt_at_ns: TEST_NOW_NS,
                result: Some(super::super::types::WalResult::Withdrawal(
                    WithdrawalWalResult {
                        block_index: u64::from(seed),
                    },
                )),
            });
        }

        // when
        let due_operation_ids = due_ids(TEST_NOW_NS, DUE_LIMIT);

        // then
        const EXPECTED_DUE_IDS_LEN: usize = DUE_LIMIT;
        assert_eq!(due_operation_ids.len(), EXPECTED_DUE_IDS_LEN);
    }
}

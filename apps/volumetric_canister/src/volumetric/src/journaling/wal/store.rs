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
        if wal.get(&operation_id).is_none() {
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
        }
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

pub(super) fn due_ids(now_ns: u64) -> Vec<OperationId> {
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
            .collect()
    })
}

fn is_actionable(entry: &WalEntry, now_ns: u64) -> bool {
    matches!(
        entry.status,
        WalStatus::Enqueued | WalStatus::FailedRetryable
    ) && entry.next_attempt_at_ns <= now_ns
}

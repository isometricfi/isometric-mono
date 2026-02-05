use std::cell::RefCell;

use candid::{CandidType, Decode, Encode, Principal};
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{StableBTreeMap, Storable};
use serde::{Deserialize, Serialize};

use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};

const MAX_WITHDRAWAL_SIZE: u32 = 512;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum WithdrawalPhase {
    Started,
    Approved,
    RetrieveRequested { block_index: u64 },
    Completed { block_index: u64 },
    Failed { reason: String },
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingWithdrawal {
    pub id: u64,
    pub principal: Principal,
    pub amount: u64,
    pub btc_address: String,
    pub phase: WithdrawalPhase,
    pub created_at: u64,
    pub updated_at: u64,
    pub created_at_time: u64,
}

impl Storable for PendingWithdrawal {
    fn to_bytes(&self) -> std::borrow::Cow<'_, [u8]> {
        std::borrow::Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    fn into_bytes(self) -> Vec<u8> {
        Encode!(&self).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_WITHDRAWAL_SIZE,
        is_fixed_size: false,
    };
}

thread_local! {
    static WITHDRAWAL_JOURNAL: RefCell<StableBTreeMap<u64, PendingWithdrawal, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(ic_stable_structures::memory_manager::MemoryId::new(MemoryIndex::WithdrawalJournalMemory as u8))),
        )
    );

}

fn next_withdrawal_id(journal: &StableBTreeMap<u64, PendingWithdrawal, Memory>) -> u64 {
    journal
        .iter()
        .fold(0u64, |max_id, entry| max_id.max(*entry.key()))
        .saturating_add(1)
}

pub fn create_withdrawal(
    principal: Principal,
    amount: u64,
    btc_address: String,
    created_at_time: u64,
) -> PendingWithdrawal {
    let now = ic_cdk::api::time();
    WITHDRAWAL_JOURNAL.with(|journal| {
        let mut journal = journal.borrow_mut();
        let id = next_withdrawal_id(&journal);
        let withdrawal = PendingWithdrawal {
            id,
            principal,
            amount,
            btc_address,
            phase: WithdrawalPhase::Started,
            created_at: now,
            updated_at: now,
            created_at_time,
        };

        journal.insert(id, withdrawal.clone());
        withdrawal
    })
}

pub fn update_withdrawal_phase(id: u64, phase: WithdrawalPhase) {
    WITHDRAWAL_JOURNAL.with(|journal| {
        let mut journal = journal.borrow_mut();
        if let Some(mut withdrawal) = journal.get(&id) {
            withdrawal.phase = phase;
            withdrawal.updated_at = ic_cdk::api::time();
            journal.insert(id, withdrawal);
        }
    });
}

pub fn complete_withdrawal(id: u64, block_index: u64) {
    update_withdrawal_phase(id, WithdrawalPhase::Completed { block_index });
}

pub fn fail_withdrawal(id: u64, reason: String) {
    update_withdrawal_phase(id, WithdrawalPhase::Failed { reason });
}

pub fn remove_withdrawal(id: u64) {
    WITHDRAWAL_JOURNAL.with(|journal| {
        journal.borrow_mut().remove(&id);
    });
}

pub fn get_withdrawal(id: u64) -> Option<PendingWithdrawal> {
    WITHDRAWAL_JOURNAL.with(|journal| journal.borrow().get(&id))
}

pub fn get_pending_withdrawals_by_principal(principal: Principal) -> Vec<PendingWithdrawal> {
    WITHDRAWAL_JOURNAL.with(|journal| {
        journal
            .borrow()
            .iter()
            .filter_map(|entry| {
                let w = entry.value();
                if w.principal == principal
                    && !matches!(
                        w.phase,
                        WithdrawalPhase::Completed { .. } | WithdrawalPhase::Failed { .. }
                    )
                {
                    Some(w)
                } else {
                    None
                }
            })
            .collect()
    })
}

pub fn list_pending_withdrawals() -> Vec<PendingWithdrawal> {
    WITHDRAWAL_JOURNAL.with(|journal| {
        journal
            .borrow()
            .iter()
            .filter_map(|entry| {
                let w = entry.value();
                if !matches!(
                    w.phase,
                    WithdrawalPhase::Completed { .. } | WithdrawalPhase::Failed { .. }
                ) {
                    Some(w)
                } else {
                    None
                }
            })
            .collect()
    })
}

pub fn list_failed_withdrawals() -> Vec<PendingWithdrawal> {
    WITHDRAWAL_JOURNAL.with(|journal| {
        journal
            .borrow()
            .iter()
            .filter_map(|entry| {
                let w = entry.value();
                if matches!(w.phase, WithdrawalPhase::Failed { .. }) {
                    Some(w)
                } else {
                    None
                }
            })
            .collect()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_principal(seed: u8) -> Principal {
        let mut bytes = [0u8; 29];
        bytes[0] = seed;
        Principal::from_slice(&bytes)
    }

    fn test_pending_withdrawal(id: u64) -> PendingWithdrawal {
        PendingWithdrawal {
            id,
            principal: test_principal(8),
            amount: 1_000,
            btc_address: "tb1qtest".to_string(),
            phase: WithdrawalPhase::Started,
            created_at: 1,
            updated_at: 1,
            created_at_time: 1,
        }
    }

    #[test]
    fn test_next_withdrawal_id_uses_existing_max_id() {
        // given
        const EXISTING_ID: u64 = 77;
        WITHDRAWAL_JOURNAL.with(|journal| {
            journal
                .borrow_mut()
                .insert(EXISTING_ID, test_pending_withdrawal(EXISTING_ID));
        });

        // when
        let next_id = WITHDRAWAL_JOURNAL.with(|journal| next_withdrawal_id(&journal.borrow()));

        // then
        const EXPECTED_NEW_ID: u64 = EXISTING_ID + 1;
        assert_eq!(next_id, EXPECTED_NEW_ID);

        WITHDRAWAL_JOURNAL.with(|journal| {
            journal.borrow_mut().remove(&EXISTING_ID);
        });
    }
}

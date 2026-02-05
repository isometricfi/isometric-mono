use std::cell::RefCell;

use candid::{CandidType, Decode, Encode, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{StableBTreeMap, Storable};
use serde::{Deserialize, Serialize};

use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};

const MAX_ACCEPT_SIZE: u32 = 1024;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum AcceptPhase {
    Started,
    CollateralLocked,
    BuyerDebited,
    TransfersComplete,
    Completed,
    Failed { reason: String },
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AcceptedOffer {
    pub offer_id: u64,
    pub writer: Principal,
    pub quantity: u64,
    pub collateral_locked: u64,
    pub premium_to_writer: u64,
    pub platform_fee: u64,
    pub option_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingAccept {
    pub id: u64,
    pub buyer: Principal,
    pub total_premium: u64,
    pub offers: Vec<AcceptedOffer>,
    pub phase: AcceptPhase,
    pub created_at: u64,
    pub updated_at: u64,
    pub fill_group_id: u64,
}

impl Storable for PendingAccept {
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
        max_size: MAX_ACCEPT_SIZE,
        is_fixed_size: false,
    };
}

thread_local! {
    static ACCEPT_JOURNAL: RefCell<StableBTreeMap<u64, PendingAccept, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::AcceptJournalMemory as u8))),
        )
    );
}

fn next_accept_id(journal: &StableBTreeMap<u64, PendingAccept, Memory>) -> u64 {
    journal
        .iter()
        .fold(0u64, |max_id, entry| max_id.max(*entry.key()))
        .saturating_add(1)
}

pub fn create_accept(
    buyer: Principal,
    total_premium: u64,
    offers: Vec<AcceptedOffer>,
    fill_group_id: u64,
) -> PendingAccept {
    let now = ic_cdk::api::time();
    ACCEPT_JOURNAL.with(|journal| {
        let mut journal = journal.borrow_mut();
        let id = next_accept_id(&journal);
        let accept = PendingAccept {
            id,
            buyer,
            total_premium,
            offers,
            phase: AcceptPhase::Started,
            created_at: now,
            updated_at: now,
            fill_group_id,
        };

        journal.insert(id, accept.clone());
        accept
    })
}

pub fn update_accept_phase(id: u64, phase: AcceptPhase) {
    ACCEPT_JOURNAL.with(|journal| {
        let mut journal = journal.borrow_mut();
        if let Some(mut accept) = journal.get(&id) {
            accept.phase = phase;
            accept.updated_at = ic_cdk::api::time();
            journal.insert(id, accept);
        }
    });
}

pub fn complete_accept(id: u64) {
    update_accept_phase(id, AcceptPhase::Completed);
}

pub fn fail_accept(id: u64, reason: String) {
    update_accept_phase(id, AcceptPhase::Failed { reason });
}

pub fn remove_accept(id: u64) {
    ACCEPT_JOURNAL.with(|journal| {
        journal.borrow_mut().remove(&id);
    });
}

pub fn get_accept(id: u64) -> Option<PendingAccept> {
    ACCEPT_JOURNAL.with(|journal| journal.borrow().get(&id))
}

pub fn list_pending_accepts() -> Vec<PendingAccept> {
    ACCEPT_JOURNAL.with(|journal| {
        journal
            .borrow()
            .iter()
            .filter_map(|entry| {
                let a = entry.value();
                if !matches!(a.phase, AcceptPhase::Completed | AcceptPhase::Failed { .. }) {
                    Some(a)
                } else {
                    None
                }
            })
            .collect()
    })
}

pub fn list_failed_accepts() -> Vec<PendingAccept> {
    ACCEPT_JOURNAL.with(|journal| {
        journal
            .borrow()
            .iter()
            .filter_map(|entry| {
                let a = entry.value();
                if matches!(a.phase, AcceptPhase::Failed { .. }) {
                    Some(a)
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

    fn test_pending_accept(id: u64) -> PendingAccept {
        PendingAccept {
            id,
            buyer: test_principal(9),
            total_premium: 1_000,
            offers: vec![],
            phase: AcceptPhase::Started,
            created_at: 1,
            updated_at: 1,
            fill_group_id: 1,
        }
    }

    #[test]
    fn test_next_accept_id_uses_existing_max_id() {
        // given
        const EXISTING_ID: u64 = 99;
        ACCEPT_JOURNAL.with(|journal| {
            journal
                .borrow_mut()
                .insert(EXISTING_ID, test_pending_accept(EXISTING_ID));
        });

        // when
        let next_id = ACCEPT_JOURNAL.with(|journal| next_accept_id(&journal.borrow()));

        // then
        const EXPECTED_NEW_ID: u64 = EXISTING_ID + 1;
        assert_eq!(next_id, EXPECTED_NEW_ID);

        ACCEPT_JOURNAL.with(|journal| {
            journal.borrow_mut().remove(&EXISTING_ID);
        });
    }
}

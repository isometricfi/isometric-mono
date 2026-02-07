use std::cell::RefCell;

use candid::{CandidType, Decode, Encode, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{StableBTreeMap, Storable};
use serde::{Deserialize, Serialize};

use crate::ic;

use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};

const MAX_SETTLEMENT_SIZE: u32 = 512;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum SettlementPhase {
    Started,
    BalanceReleased,
    TransferComplete,
    Completed,
    Failed { reason: String },
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingSettlement {
    pub option_id: u64,
    pub writer: Principal,
    pub buyer: Principal,
    pub payout_to_buyer: u64,
    pub payout_to_writer: u64,
    pub settlement_price_cents: u64,
    pub phase: SettlementPhase,
    pub created_at: u64,
    pub updated_at: u64,
}

impl Storable for PendingSettlement {
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
        max_size: MAX_SETTLEMENT_SIZE,
        is_fixed_size: false,
    };
}

thread_local! {
    static SETTLEMENT_JOURNAL: RefCell<StableBTreeMap<u64, PendingSettlement, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::SettlementJournalMemory as u8))),
        )
    );
}

pub fn create_settlement(
    option_id: u64,
    writer: Principal,
    buyer: Principal,
    payout_to_buyer: u64,
    payout_to_writer: u64,
    settlement_price_cents: u64,
) -> PendingSettlement {
    let now = ic::time();

    let settlement = PendingSettlement {
        option_id,
        writer,
        buyer,
        payout_to_buyer,
        payout_to_writer,
        settlement_price_cents,
        phase: SettlementPhase::Started,
        created_at: now,
        updated_at: now,
    };

    SETTLEMENT_JOURNAL.with(|journal| {
        journal.borrow_mut().insert(option_id, settlement.clone());
    });

    settlement
}

pub fn update_settlement_phase(option_id: u64, phase: SettlementPhase) {
    SETTLEMENT_JOURNAL.with(|journal| {
        let mut journal = journal.borrow_mut();
        if let Some(mut settlement) = journal.get(&option_id) {
            settlement.phase = phase;
            settlement.updated_at = ic::time();
            journal.insert(option_id, settlement);
        }
    });
}

pub fn complete_settlement(option_id: u64) {
    update_settlement_phase(option_id, SettlementPhase::Completed);
}

pub fn fail_settlement(option_id: u64, reason: String) {
    update_settlement_phase(option_id, SettlementPhase::Failed { reason });
}

pub fn remove_settlement(option_id: u64) {
    SETTLEMENT_JOURNAL.with(|journal| {
        journal.borrow_mut().remove(&option_id);
    });
}

pub fn get_settlement(option_id: u64) -> Option<PendingSettlement> {
    SETTLEMENT_JOURNAL.with(|journal| journal.borrow().get(&option_id))
}

pub fn list_pending_settlements_journal() -> Vec<PendingSettlement> {
    SETTLEMENT_JOURNAL.with(|journal| {
        journal
            .borrow()
            .iter()
            .filter_map(|entry| {
                let s = entry.value();
                if !matches!(
                    s.phase,
                    SettlementPhase::Completed | SettlementPhase::Failed { .. }
                ) {
                    Some(s)
                } else {
                    None
                }
            })
            .collect()
    })
}

pub fn list_failed_settlements() -> Vec<PendingSettlement> {
    SETTLEMENT_JOURNAL.with(|journal| {
        journal
            .borrow()
            .iter()
            .filter_map(|entry| {
                let s = entry.value();
                if matches!(s.phase, SettlementPhase::Failed { .. }) {
                    Some(s)
                } else {
                    None
                }
            })
            .collect()
    })
}

use std::cell::RefCell;

use candid::{CandidType, Decode, Encode, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{StableBTreeMap, Storable};
use serde::{Deserialize, Serialize};

use crate::ic;

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
    pub total_buyer_debit_required_sats: u64,
    pub offers: Vec<AcceptedOffer>,
    pub phase: AcceptPhase,
    pub created_at: u64,
    pub updated_at: u64,
    pub fill_group_id: u64,
    pub entry_price_cents: Option<u64>,
    pub platform_fee_collected: Option<bool>,
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
    pub(crate) static ACCEPT_JOURNAL: RefCell<StableBTreeMap<u64, PendingAccept, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::AcceptJournalMemory as u8))),
        )
    );
}

pub fn create_accept_journal_entry(
    buyer: Principal,
    total_buyer_debit_required_sats: u64,
    offers: Vec<AcceptedOffer>,
    fill_group_id: u64,
) -> PendingAccept {
    let now = ic::time();
    let id = super::next_id(super::CounterKey::AcceptJournalId);

    let accept = PendingAccept {
        id,
        buyer,
        total_buyer_debit_required_sats,
        offers,
        phase: AcceptPhase::Started,
        created_at: now,
        updated_at: now,
        fill_group_id,
        entry_price_cents: None,
        platform_fee_collected: None,
    };

    ACCEPT_JOURNAL.with(|journal| {
        journal.borrow_mut().insert(id, accept.clone());
    });

    accept
}

pub fn update_accept_phase(id: u64, phase: AcceptPhase) {
    ACCEPT_JOURNAL.with(|journal| {
        let mut journal = journal.borrow_mut();
        if let Some(mut accept) = journal.get(&id) {
            accept.phase = phase;
            accept.updated_at = ic::time();
            journal.insert(id, accept);
        }
    });
}

pub fn update_accept_execution_snapshot(
    id: u64,
    entry_price_cents: u64,
    platform_fee_collected: bool,
) {
    ACCEPT_JOURNAL.with(|journal| {
        let mut journal = journal.borrow_mut();
        if let Some(mut accept) = journal.get(&id) {
            accept.entry_price_cents = Some(entry_price_cents);
            accept.platform_fee_collected = Some(platform_fee_collected);
            accept.updated_at = ic::time();
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

use std::cell::RefCell;

use candid::{CandidType, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::StableBTreeMap;
use serde::{Deserialize, Serialize};

use super::cbor::Cbor;
use super::options::{CounterKey, COUNTERS};
use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};

thread_local! {
    pub static EVENTS: RefCell<StableBTreeMap<u64, Cbor<Event>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::EventsMemory as u8))),
        )
    );
}

#[derive(Debug, Clone, Serialize, Deserialize, CandidType)]
pub struct Event {
    pub id: u64,
    pub event_type: EventType,
    pub principal: Principal,
    pub timestamp: u64,
    pub data: EventData,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, CandidType)]
pub enum EventType {
    AccountCreated,
    UsernameUpdated,
    Deposit,
    Withdrawal,
    WithdrawalFailed,
    OfferCreated,
    OfferCancelled,
    OfferAccepted,
    OfferAcceptFailed,
    OptionSettled,
    OptionSettlementFailed,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, CandidType)]
pub enum TradeRole {
    Buyer,
    Writer,
}

#[derive(Debug, Clone, Serialize, Deserialize, CandidType)]
pub enum EventData {
    AccountCreated {
        wallet_address: String,
    },
    UsernameUpdated {
        old_username: Option<String>,
        new_username: String,
    },
    Deposit {
        amount_sats: u64,
    },
    Withdrawal {
        amount_sats: u64,
        destination: String,
    },
    WithdrawalFailed {
        amount_sats: u64,
        reason: String,
    },
    OfferCreated {
        offer_id: u64,
        quantity_sats: u64,
        strike_basis_points: u16,
        premium_basis_points: u16,
        duration_seconds: u64,
    },
    OfferCancelled {
        offer_id: u64,
    },
    OfferAccepted {
        offer_id: u64,
        option_id: u64,
        quantity_sats: u64,
        premium_sats: u64,
        role: TradeRole,
    },
    OfferAcceptFailed {
        offer_ids: Vec<u64>,
        reason: String,
    },
    OptionSettled {
        option_id: u64,
        settlement_price_cents: u64,
        payout_sats: u64,
        role: TradeRole,
    },
    OptionSettlementFailed {
        option_id: u64,
        reason: String,
    },
    #[serde(other)]
    Unknown,
}

fn next_event_id() -> u64 {
    COUNTERS.with_borrow_mut(|c| {
        let key = CounterKey::EventId;
        let current = c.get(&key).unwrap_or(0);
        let next = current.saturating_add(1);
        c.insert(key, next);
        next
    })
}

pub fn emit_event(principal: Principal, event_type: EventType, data: EventData) -> Option<u64> {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let id = next_event_id();
        let event = Event {
            id,
            event_type,
            principal,
            timestamp: ic_cdk::api::time(),
            data,
        };

        EVENTS.with_borrow_mut(|e| {
            e.insert(id, Cbor(event));
        });

        id
    }));

    match result {
        Ok(id) => Some(id),
        Err(_) => {
            ic_cdk::println!("Failed to emit event - continuing without event");
            None
        }
    }
}

pub fn get_events_by_principal(
    principal: Principal,
    after_id: Option<u64>,
    limit: u32,
) -> Vec<Event> {
    EVENTS.with_borrow(|e| {
        let start_id = after_id.map(|id| id + 1).unwrap_or(0);
        e.range(start_id..)
            .filter_map(|entry| {
                let event = entry.value().0.clone();
                if event.principal == principal {
                    Some(event)
                } else {
                    None
                }
            })
            .take(limit as usize)
            .collect()
    })
}

pub fn get_events_since(timestamp: u64, limit: u32) -> Vec<Event> {
    EVENTS.with_borrow(|e| {
        e.iter()
            .filter_map(|entry| {
                let event = entry.value().0.clone();
                if event.timestamp >= timestamp {
                    Some(event)
                } else {
                    None
                }
            })
            .take(limit as usize)
            .collect()
    })
}

pub fn get_all_events(after_id: Option<u64>, limit: u32) -> Vec<Event> {
    EVENTS.with_borrow(|e| {
        let start_id = after_id.map(|id| id + 1).unwrap_or(0);
        e.range(start_id..)
            .map(|entry| entry.value().0.clone())
            .take(limit as usize)
            .collect()
    })
}

pub fn delete_events_before(older_than_ns: u64) -> u64 {
    EVENTS.with_borrow_mut(|e| {
        let keys_to_remove: Vec<u64> = e
            .iter()
            .filter_map(|entry| {
                if entry.value().0.timestamp < older_than_ns {
                    Some(entry.key().clone())
                } else {
                    None
                }
            })
            .collect();

        let count = keys_to_remove.len() as u64;
        for key in keys_to_remove {
            e.remove(&key);
        }
        count
    })
}

pub fn get_event_count() -> u64 {
    EVENTS.with_borrow(|e| e.len())
}

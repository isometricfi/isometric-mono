use std::cell::RefCell;

use candid::{CandidType, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::StableBTreeMap;
use serde::{Deserialize, Serialize};

use super::cbor::Cbor;
use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};

pub const MINIMUM_QUANTITY_SATS: u64 = 50_000;
const BASIS_POINTS_DENOMINATOR: u128 = 10_000;

thread_local! {
    pub static OFFERS: RefCell<StableBTreeMap<u64, Cbor<Offer>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::OffersMemory as u8))),
        )
    );

    pub static ACTIVE_OPTIONS: RefCell<StableBTreeMap<u64, Cbor<ActiveOption>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::ActiveOptionsMemory as u8))),
        )
    );

    pub static COUNTERS: RefCell<StableBTreeMap<CounterKey, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::CountersMemory as u8))),
        )
    );
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum CounterKey {
    OfferId = 0,
    ActiveOptionId = 1,
    FillGroupId = 2,
    EventId = 3,
    AcceptJournalId = 4,
    WithdrawalJournalId = 5,
    PlatformFeesCollectedTotal = 6,
}

impl ic_stable_structures::Storable for CounterKey {
    fn to_bytes(&self) -> std::borrow::Cow<'_, [u8]> {
        std::borrow::Cow::Owned(vec![*self as u8])
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        match bytes.as_ref().first() {
            Some(0) => CounterKey::OfferId,
            Some(1) => CounterKey::ActiveOptionId,
            Some(2) => CounterKey::FillGroupId,
            Some(3) => CounterKey::EventId,
            Some(4) => CounterKey::AcceptJournalId,
            Some(5) => CounterKey::WithdrawalJournalId,
            Some(6) => CounterKey::PlatformFeesCollectedTotal,
            _ => CounterKey::OfferId,
        }
    }

    fn into_bytes(self) -> Vec<u8> {
        vec![self as u8]
    }

    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Bounded {
            max_size: 1,
            is_fixed_size: true,
        };
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, CandidType)]
pub enum Asset {
    CkBtc,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, CandidType)]
pub enum OptionType {
    Call,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, CandidType)]
pub enum OfferStatus {
    /// Offer is available for buyers to accept
    Open,
    /// Some quantity has been filled but more remains available
    PartiallyFilled,
    /// All quantity has been accepted, no more available
    Filled,
    /// Writer cancelled the offer, no longer accepting
    Cancelled,
    /// Transient state during accept_offers to prevent race conditions across await points
    Processing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, CandidType)]
pub enum ActiveOptionStatus {
    /// Option is live, awaiting expiry for settlement
    Active,
    /// Transient state during settlement to prevent race conditions across await points
    Settling,
    /// Option has been settled with payouts distributed
    Settled,
    /// Option expired without settlement (should not normally occur, settlement auto-runs)
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize, CandidType)]
pub struct Offer {
    pub id: u64,
    pub writer: Principal,
    pub asset: Asset,
    pub option_type: OptionType,
    pub strike_basis_points: u16,
    pub premium_basis_points: u16,
    pub total_quantity: u64,
    pub remaining_quantity: u64,
    pub offer_valid_until_seconds: u64,
    pub option_duration_seconds: u64,
    pub status: OfferStatus,
    pub created_at_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, CandidType)]
pub struct ActiveOption {
    pub id: u64,
    pub offer_id: u64,
    pub buyer: Principal,
    pub writer: Principal,
    pub asset: Asset,
    pub option_type: OptionType,
    pub quantity: u64,
    pub entry_price_cents: u64,
    pub strike_price_cents: u64,
    pub premium_paid: u64,
    pub accepted_at_seconds: u64,
    pub expiry_seconds: u64,
    pub status: ActiveOptionStatus,
    pub fill_group_id: Option<u64>,
    #[serde(default)]
    pub profit_fee_basis_points: u64,
}

pub fn next_id(key: CounterKey) -> u64 {
    COUNTERS.with_borrow_mut(|c| {
        let current = c.get(&key).unwrap_or(0);
        let next = current.saturating_add(1);
        c.insert(key, next);
        next
    })
}

pub fn get_offer(id: u64) -> Option<Offer> {
    OFFERS.with_borrow(|o| o.get(&id).map(|c| c.0))
}

pub fn insert_offer(offer: Offer) {
    OFFERS.with_borrow_mut(|o| {
        o.insert(offer.id, Cbor(offer));
    });
}

pub fn update_offer(offer: Offer) {
    OFFERS.with_borrow_mut(|o| {
        o.insert(offer.id, Cbor(offer));
    });
}

// TODO: Add secondary index (Principal -> Vec<u64>) for O(1) lookups as data grows.
// Current implementation is O(n) full table scan.
// TODO: ADD IF NEEDED LATER :D
pub fn list_offers_by_writer(writer: Principal) -> Vec<Offer> {
    OFFERS.with_borrow(|o| {
        o.iter()
            .filter_map(|entry| {
                let offer = entry.value().0;
                if offer.writer == writer {
                    Some(offer)
                } else {
                    None
                }
            })
            .collect()
    })
}

// TODO: Add secondary index for open offers as data grows. Current implementation is O(n).
pub fn list_open_offers() -> Vec<Offer> {
    OFFERS.with_borrow(|o| {
        o.iter()
            .filter_map(|entry| {
                let offer = entry.value().0;
                if matches!(
                    offer.status,
                    OfferStatus::Open | OfferStatus::PartiallyFilled
                ) {
                    Some(offer)
                } else {
                    None
                }
            })
            .collect()
    })
}

pub fn get_active_option(id: u64) -> Option<ActiveOption> {
    ACTIVE_OPTIONS.with_borrow(|a| a.get(&id).map(|c| c.0))
}

pub fn insert_active_option(option: ActiveOption) {
    ACTIVE_OPTIONS.with_borrow_mut(|a| {
        a.insert(option.id, Cbor(option));
    });
}

pub fn update_active_option(option: ActiveOption) {
    ACTIVE_OPTIONS.with_borrow_mut(|a| {
        a.insert(option.id, Cbor(option));
    });
}

pub fn list_active_options_by_buyer(buyer: Principal) -> Vec<ActiveOption> {
    ACTIVE_OPTIONS.with_borrow(|a| {
        a.iter()
            .filter_map(|entry| {
                let option = entry.value().0;
                if option.buyer == buyer {
                    Some(option)
                } else {
                    None
                }
            })
            .collect()
    })
}

pub fn list_active_options_by_writer(writer: Principal) -> Vec<ActiveOption> {
    ACTIVE_OPTIONS.with_borrow(|a| {
        a.iter()
            .filter_map(|entry| {
                let option = entry.value().0;
                if option.writer == writer {
                    Some(option)
                } else {
                    None
                }
            })
            .collect()
    })
}

pub fn list_active_options() -> Vec<ActiveOption> {
    ACTIVE_OPTIONS.with_borrow(|a| {
        a.iter()
            .filter_map(|entry| {
                let option = entry.value().0;
                if matches!(option.status, ActiveOptionStatus::Active) {
                    Some(option)
                } else {
                    None
                }
            })
            .collect()
    })
}

pub fn list_expired_active_options(current_time: u64) -> Vec<ActiveOption> {
    ACTIVE_OPTIONS.with_borrow(|a| {
        a.iter()
            .filter_map(|entry| {
                let option = entry.value().0;
                if option.status == ActiveOptionStatus::Active
                    && option.expiry_seconds <= current_time
                {
                    Some(option)
                } else {
                    None
                }
            })
            .collect()
    })
}

pub fn calculate_premium_in_sats(quantity_sats: u64, premium_basis_points: u16) -> u64 {
    let premium_amount_sats =
        (quantity_sats as u128 * premium_basis_points as u128) / BASIS_POINTS_DENOMINATOR;
    premium_amount_sats as u64
}

pub fn calculate_strike_price_in_cents(entry_price_cents: u64, strike_basis_points: u16) -> u64 {
    let strike_price_increase_cents =
        (entry_price_cents as u128 * strike_basis_points as u128) / BASIS_POINTS_DENOMINATOR;
    entry_price_cents.saturating_add(strike_price_increase_cents as u64)
}

pub fn calculate_call_option_payout(
    settlement_price_cents: u64,
    strike_price_cents: u64,
    quantity_sats: u64,
) -> u64 {
    if settlement_price_cents <= strike_price_cents {
        return 0;
    }

    let profit_cents = settlement_price_cents - strike_price_cents;
    let payout = (quantity_sats as u128 * profit_cents as u128) / settlement_price_cents as u128;
    payout as u64
}

/// Clears all offers from storage. Used for testing/migration purposes.
pub fn clear_offers() -> u64 {
    OFFERS.with_borrow_mut(|o| {
        let keys: Vec<u64> = o.iter().map(|entry| *entry.key()).collect();
        let count = keys.len() as u64;
        for key in keys {
            o.remove(&key);
        }
        count
    })
}

/// Clears all active options from storage. Used for testing/migration purposes.
pub fn clear_active_options() -> u64 {
    ACTIVE_OPTIONS.with_borrow_mut(|a| {
        let keys: Vec<u64> = a.iter().map(|entry| *entry.key()).collect();
        let count = keys.len() as u64;
        for key in keys {
            a.remove(&key);
        }
        count
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_strike_price_5_percent() {
        // given
        let entry_price_cents: u64 = 10_000_000;
        let strike_basis_points: u16 = 500;

        // when
        let strike = calculate_strike_price_in_cents(entry_price_cents, strike_basis_points);

        // then
        let expected = 10_500_000;
        assert_eq!(strike, expected);
    }

    #[test]
    fn test_calculate_strike_price_10_percent() {
        // given
        let entry_price_cents: u64 = 10_000_000;
        let strike_basis_points: u16 = 1000;

        // when
        let strike = calculate_strike_price_in_cents(entry_price_cents, strike_basis_points);

        // then
        let expected = 11_000_000;
        assert_eq!(strike, expected);
    }

    #[test]
    fn test_calculate_strike_price_zero() {
        // given
        let entry_price_cents: u64 = 10_000_000;
        let strike_basis_points: u16 = 0;

        // when
        let strike = calculate_strike_price_in_cents(entry_price_cents, strike_basis_points);

        // then
        assert_eq!(strike, entry_price_cents);
    }

    #[test]
    fn test_itm_payout() {
        // given
        let settlement = 12_000_000;
        let strike = 10_000_000;
        let quantity = 50_000_000;

        // when
        let payout = calculate_call_option_payout(settlement, strike, quantity);

        // then
        let profit_cents = settlement - strike;
        let expected = (quantity as u128 * profit_cents as u128) / settlement as u128;
        assert_eq!(payout, expected as u64);
    }

    #[test]
    fn test_otm_payout() {
        // given
        let settlement = 9_000_000;
        let strike = 10_000_000;
        let quantity = 50_000_000;

        // when
        let payout = calculate_call_option_payout(settlement, strike, quantity);

        // then
        assert_eq!(payout, 0);
    }

    #[test]
    fn test_atm_payout() {
        // given
        let settlement = 10_000_000;
        let strike = 10_000_000;
        let quantity = 50_000_000;

        // when
        let payout = calculate_call_option_payout(settlement, strike, quantity);

        // then
        assert_eq!(payout, 0);
    }
}

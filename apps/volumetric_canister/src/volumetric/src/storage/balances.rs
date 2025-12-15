use std::cell::{Cell, RefCell};

use candid::{CandidType, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::StableBTreeMap;
use serde::{Deserialize, Serialize};

use super::cbor::Cbor;
use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};

pub const CKBTC_TRANSFER_FEE: u64 = 10;
pub const PLATFORM_FEE_BASIS_POINTS: u64 = 1000;
pub const PLATFORM_FEE_RECIPIENT: &str =
    "a6nyt-23cn7-g5zvc-pxir2-dfi7d-z726j-vz4ky-ds6a2-2a4rb-6g7kp-7qe";

pub fn get_platform_fee_recipient() -> Principal {
    Principal::from_text(PLATFORM_FEE_RECIPIENT).expect("Invalid platform fee recipient principal")
}

thread_local! {
    pub static BALANCES: RefCell<StableBTreeMap<Principal, Cbor<UserBalance>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::BalancesMemory as u8))),
        )
    );

    static PLATFORM_FEES_COLLECTED: Cell<u64> = const { Cell::new(0) };
}

pub fn add_platform_fee(amount: u64) {
    PLATFORM_FEES_COLLECTED.with(|f| f.set(f.get().saturating_add(amount)));
}

pub fn get_platform_fees_collected() -> u64 {
    PLATFORM_FEES_COLLECTED.with(|f| f.get())
}

pub fn calculate_platform_fee(premium: u64) -> u64 {
    (premium * PLATFORM_FEE_BASIS_POINTS) / 10_000
}

#[derive(Debug, Clone, Serialize, Deserialize, CandidType, Default)]
pub struct UserBalance {
    pub available: u64,
    pub locked_as_writer: u64,
}

impl UserBalance {
    pub fn total(&self) -> u64 {
        self.available.saturating_add(self.locked_as_writer)
    }
}

pub fn get_balance(principal: &Principal) -> UserBalance {
    BALANCES
        .with_borrow(|b| b.get(principal).map(|c| c.0))
        .unwrap_or_default()
}

pub fn set_balance(principal: Principal, balance: UserBalance) {
    BALANCES.with_borrow_mut(|b| {
        b.insert(principal, Cbor(balance));
    });
}

pub fn add_available(principal: Principal, amount: u64) {
    BALANCES.with_borrow_mut(|b| {
        let mut balance = b.get(&principal).map(|c| c.0).unwrap_or_default();
        balance.available = balance.available.saturating_add(amount);
        b.insert(principal, Cbor(balance));
    });
}

// Subtracts from available balance. Returns error if insufficient funds.
// Uses checked arithmetic - will never panic, returns InsufficientBalance instead.
pub fn subtract_available(principal: Principal, amount: u64) -> Result<(), InsufficientBalance> {
    BALANCES.with_borrow_mut(|b| {
        let mut balance = b.get(&principal).map(|c| c.0).unwrap_or_default();
        if balance.available < amount {
            return Err(InsufficientBalance {
                available: balance.available,
                required: amount,
            });
        }
        balance.available = balance.available.saturating_sub(amount);
        b.insert(principal, Cbor(balance));
        Ok(())
    })
}

// Moves funds from available to locked. This is atomic within the canister (single-threaded).
// Returns error if insufficient available funds.
pub fn lock_collateral(principal: Principal, amount: u64) -> Result<(), InsufficientBalance> {
    BALANCES.with_borrow_mut(|b| {
        let mut balance = b.get(&principal).map(|c| c.0).unwrap_or_default();
        if balance.available < amount {
            return Err(InsufficientBalance {
                available: balance.available,
                required: amount,
            });
        }
        balance.available = balance.available.saturating_sub(amount);
        balance.locked_as_writer = balance.locked_as_writer.saturating_add(amount);
        b.insert(principal, Cbor(balance));
        Ok(())
    })
}

// Moves funds from locked back to available. Returns error if insufficient locked funds.
pub fn unlock_collateral(principal: Principal, amount: u64) -> Result<(), InsufficientBalance> {
    BALANCES.with_borrow_mut(|b| {
        let mut balance = b.get(&principal).map(|c| c.0).unwrap_or_default();
        if balance.locked_as_writer < amount {
            return Err(InsufficientBalance {
                available: balance.locked_as_writer,
                required: amount,
            });
        }
        balance.locked_as_writer = balance.locked_as_writer.saturating_sub(amount);
        balance.available = balance.available.saturating_add(amount);
        b.insert(principal, Cbor(balance));
        Ok(())
    })
}

// Releases locked collateral from writer directly to recipient's available balance.
// Both operations happen atomically (single-threaded canister).
// Returns error if writer has insufficient locked funds.
pub fn release_locked_to_recipient(
    writer: Principal,
    recipient: Principal,
    amount: u64,
) -> Result<(), InsufficientBalance> {
    BALANCES.with_borrow_mut(|b| {
        let mut writer_balance = b.get(&writer).map(|c| c.0).unwrap_or_default();
        if writer_balance.locked_as_writer < amount {
            return Err(InsufficientBalance {
                available: writer_balance.locked_as_writer,
                required: amount,
            });
        }
        writer_balance.locked_as_writer = writer_balance.locked_as_writer.saturating_sub(amount);
        b.insert(writer, Cbor(writer_balance));

        let mut recipient_balance = b.get(&recipient).map(|c| c.0).unwrap_or_default();
        recipient_balance.available = recipient_balance.available.saturating_add(amount);
        b.insert(recipient, Cbor(recipient_balance));
        Ok(())
    })
}

#[derive(Debug, Clone)]
pub struct InsufficientBalance {
    pub available: u64,
    pub required: u64,
}

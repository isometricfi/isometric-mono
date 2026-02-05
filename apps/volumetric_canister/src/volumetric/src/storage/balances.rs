use std::cell::RefCell;

use candid::{CandidType, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::{StableBTreeMap, StableCell};
use serde::{Deserialize, Serialize};

use super::cbor::Cbor;
use super::config::Config;
use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};

pub const CKBTC_TRANSFER_FEE: u64 = 10;

pub fn get_fee_recipient() -> Principal {
    Config::fee_config().fee_recipient
}

thread_local! {
    pub static BALANCES: RefCell<StableBTreeMap<Principal, Cbor<UserBalance>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::BalancesMemory as u8))),
        )
    );

    static PLATFORM_FEES_COLLECTED: RefCell<StableCell<Cbor<u64>, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::PlatformFeesMemory as u8))),
            Cbor(0)
        )
    );
}

pub fn add_platform_fee(amount: u64) {
    PLATFORM_FEES_COLLECTED.with_borrow_mut(|f| {
        let updated = f.get().0.saturating_add(amount);
        let _ = f.set(Cbor(updated));
    });
}

pub fn get_platform_fees_collected() -> u64 {
    PLATFORM_FEES_COLLECTED.with_borrow(|f| f.get().0)
}

pub fn calculate_premium_fee(premium: u64) -> u64 {
    let fee_config = Config::fee_config();
    (premium * fee_config.premium_fee_basis_points) / 10_000
}

pub fn calculate_profit_fee(profit: u64, profit_fee_basis_points: u64) -> u64 {
    (profit * profit_fee_basis_points) / 10_000
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

// Releases locked collateral from writer directly to buyer's available balance.
// Both operations happen atomically (single-threaded canister).
// Returns error if writer has insufficient locked funds.
pub fn release_locked_to_buyer(
    writer: Principal,
    buyer: Principal,
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

        let mut buyer_balance = b.get(&buyer).map(|c| c.0).unwrap_or_default();
        buyer_balance.available = buyer_balance.available.saturating_add(amount);
        b.insert(buyer, Cbor(buyer_balance));
        Ok(())
    })
}

// Reverses release_locked_to_buyer: moves funds from buyer's available back to writer's locked.
// Used when a ledger transfer fails after the internal balance update succeeded.
pub fn reverse_release_locked_to_buyer(
    writer: Principal,
    buyer: Principal,
    amount: u64,
) -> Result<(), InsufficientBalance> {
    BALANCES.with_borrow_mut(|b| {
        let mut buyer_balance = b.get(&buyer).map(|c| c.0).unwrap_or_default();
        if buyer_balance.available < amount {
            return Err(InsufficientBalance {
                available: buyer_balance.available,
                required: amount,
            });
        }
        buyer_balance.available = buyer_balance.available.saturating_sub(amount);
        b.insert(buyer, Cbor(buyer_balance));

        let mut writer_balance = b.get(&writer).map(|c| c.0).unwrap_or_default();
        writer_balance.locked_as_writer = writer_balance.locked_as_writer.saturating_add(amount);
        b.insert(writer, Cbor(writer_balance));
        Ok(())
    })
}

#[derive(Debug, Clone)]
pub struct InsufficientBalance {
    pub available: u64,
    pub required: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_platform_fee_uses_stable_counter() {
        // given
        const FEE_INCREMENT: u64 = 1234;
        let initial = get_platform_fees_collected();

        // when
        add_platform_fee(FEE_INCREMENT);

        // then
        let updated = get_platform_fees_collected();
        assert_eq!(updated, initial.saturating_add(FEE_INCREMENT));

        PLATFORM_FEES_COLLECTED.with_borrow_mut(|f| {
            let _ = f.set(Cbor(initial));
        });
    }
}

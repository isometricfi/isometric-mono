use std::cell::RefCell;

use candid::{CandidType, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::StableBTreeMap;
use serde::{Deserialize, Serialize};

use super::cbor::Cbor;
use super::config::Config;
use super::options::{CounterKey, COUNTERS};
use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};
use crate::errors::{error_codes, VolumetricError};

const BASIS_POINTS_DENOMINATOR: u128 = 10_000;

pub fn get_fee_recipient() -> Principal {
    Config::fee_config().fee_recipient
}

thread_local! {
    pub static BALANCES: RefCell<StableBTreeMap<Principal, Cbor<UserBalance>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::BalancesMemory as u8))),
        )
    );
}

pub fn add_platform_fee(amount: u64) {
    let key = CounterKey::PlatformFeesCollectedTotal;
    COUNTERS.with_borrow_mut(|c| {
        let current = c.get(&key).unwrap_or(0);
        let next = current.saturating_add(amount);
        c.insert(key, next);
    });
}

pub fn get_platform_fees_collected() -> u64 {
    COUNTERS.with_borrow(|c| c.get(&CounterKey::PlatformFeesCollectedTotal).unwrap_or(0))
}

pub fn calculate_premium_fee(premium: u64) -> Result<u64, VolumetricError> {
    let fee_config = Config::fee_config();
    calculate_fee_from_basis_points(premium, fee_config.premium_fee_basis_points)
}

pub fn calculate_profit_fee(
    profit: u64,
    profit_fee_basis_points: u64,
) -> Result<u64, VolumetricError> {
    calculate_fee_from_basis_points(profit, profit_fee_basis_points)
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

pub fn deduct_locked_collateral(
    principal: Principal,
    amount: u64,
) -> Result<(), InsufficientBalance> {
    BALANCES.with_borrow_mut(|b| {
        let mut balance = b.get(&principal).map(|c| c.0).unwrap_or_default();
        if balance.locked_as_writer < amount {
            return Err(InsufficientBalance {
                available: balance.locked_as_writer,
                required: amount,
            });
        }
        balance.locked_as_writer = balance.locked_as_writer.saturating_sub(amount);
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

fn calculate_fee_from_basis_points(
    amount: u64,
    fee_basis_points: u64,
) -> Result<u64, VolumetricError> {
    let fee_amount = u128::from(amount) * u128::from(fee_basis_points) / BASIS_POINTS_DENOMINATOR;
    u64::try_from(fee_amount).map_err(|_| {
        VolumetricError::from_def(
            error_codes::FEE_CALCULATION_OVERFLOW,
            Some(&format!(
                "amount: {}, basis_points: {}",
                amount, fee_basis_points
            )),
            None,
        )
    })
}

#[cfg(test)]
mod tests {
    use super::{calculate_premium_fee, calculate_profit_fee};
    use crate::storage::Config;

    #[test]
    fn calculate_profit_fee_should_handle_large_inputs_without_overflow() {
        // given
        const LARGE_PROFIT_SATS: u64 = u64::MAX;
        const LARGE_PROFIT_FEE_BASIS_POINTS: u64 = u64::MAX;
        // when
        let profit_fee_sats =
            calculate_profit_fee(LARGE_PROFIT_SATS, LARGE_PROFIT_FEE_BASIS_POINTS);

        // then
        assert!(profit_fee_sats.is_err());
    }

    #[test]
    fn calculate_premium_fee_should_handle_large_inputs_without_overflow() {
        // given
        const LARGE_PREMIUM_SATS: u64 = u64::MAX;
        const LARGE_PREMIUM_FEE_BASIS_POINTS: u64 = u64::MAX;
        Config::set_premium_fee_basis_points(LARGE_PREMIUM_FEE_BASIS_POINTS);

        // when
        let premium_fee_sats = calculate_premium_fee(LARGE_PREMIUM_SATS);

        // then
        assert!(premium_fee_sats.is_err());
    }
}

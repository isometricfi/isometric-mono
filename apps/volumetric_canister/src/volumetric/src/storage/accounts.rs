use std::cell::RefCell;

use candid::{CandidType, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::StableBTreeMap;
use serde::{Deserialize, Serialize};

use super::cbor::Cbor;
use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};
use crate::auth::types::WalletKey;

thread_local! {
    /// Replay protection: tracks signature nonces per wallet address.
    pub static NONCES: RefCell<StableBTreeMap<WalletKey, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::NoncesMemory as u8))),
        )
    );

    /// User profile data keyed by derived principal.
    pub static PROFILES: RefCell<StableBTreeMap<Principal, Cbor<Profile>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::ProfilesMemory as u8))),
        )
    );

    /// Reverse lookup: wallet address → derived principal.
    pub static WALLET_REGISTRY: RefCell<StableBTreeMap<WalletKey, Principal, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::WalletsMemory as u8))),
        )
    );
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct Profile {
    pub wallet_address: String,
    pub username: Option<String>,
    pub created_at: u64,
}

pub fn get_nonce(wallet_key: &WalletKey) -> u64 {
    NONCES.with_borrow(|n| n.get(wallet_key).unwrap_or(0))
}

pub fn increment_nonce(wallet_key: &WalletKey) {
    NONCES.with_borrow_mut(|n| {
        let current = n.get(wallet_key).unwrap_or(0);
        n.insert(*wallet_key, current + 1);
    });
}

pub fn get_profile(principal: &Principal) -> Option<Profile> {
    PROFILES.with_borrow(|p| p.get(principal).map(|cbor| cbor.0))
}

pub fn create_profile(principal: Principal, profile: Profile) {
    PROFILES.with_borrow_mut(|p| {
        p.insert(principal, Cbor(profile));
    });
}

pub fn is_profile_exists(principal: &Principal) -> bool {
    PROFILES.with_borrow(|p| p.contains_key(principal))
}

pub fn get_principal_for_wallet(wallet_key: &WalletKey) -> Option<Principal> {
    WALLET_REGISTRY.with_borrow(|w| w.get(wallet_key))
}

pub fn register_wallet(wallet_key: WalletKey, principal: Principal) {
    WALLET_REGISTRY.with_borrow_mut(|w| {
        w.insert(wallet_key, principal);
    });
}

pub fn is_wallet_registered(wallet_key: &WalletKey) -> bool {
    WALLET_REGISTRY.with_borrow(|w| w.contains_key(wallet_key))
}

pub fn update_profile(principal: Principal, profile: Profile) {
    PROFILES.with_borrow_mut(|p| {
        p.insert(principal, Cbor(profile));
    });
}

pub fn list_all_profiles() -> Vec<(Principal, Profile)> {
    PROFILES.with_borrow(|p| {
        p.iter()
            .map(|entry| (entry.key().clone(), entry.value().0.clone()))
            .collect()
    })
}

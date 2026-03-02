use std::borrow::Cow;
use std::cell::RefCell;

use candid::{CandidType, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{StableBTreeMap, Storable};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::cbor::Cbor;
use super::config::Config;
use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};
use crate::ic;

const INVITE_CODE_LENGTH: usize = 6;
const INVITE_ALPHABET: &[u8; 36] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

thread_local! {
    pub static USER_POINTS: RefCell<StableBTreeMap<Principal, Cbor<PointsProfile>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::PointsMemory as u8))),
        )
    );

    pub static INVITE_CODE_REGISTRY: RefCell<StableBTreeMap<InviteCodeKey, Principal, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::InviteCodeRegistryMemory as u8))),
        )
    );

    pub static PRINCIPAL_INVITE_CODES: RefCell<StableBTreeMap<Principal, InviteCodeKey, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::PrincipalInviteCodeMemory as u8))),
        )
    );

    pub static REFERRAL_LINKS: RefCell<StableBTreeMap<Principal, Principal, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::ReferralLinksMemory as u8))),
        )
    );
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, CandidType)]
pub enum PointsReason {
    OfferAcceptedBuyer,
    OfferAcceptedWriter,
    BuyerWinBonus,
    ReferralBonus,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, CandidType)]
pub struct PointsProfile {
    pub total_points: u64,
    #[serde(default)]
    pub points_from_offer_accepted_buyer: u64,
    #[serde(default)]
    pub points_from_offer_accepted_writer: u64,
    #[serde(default)]
    pub points_from_buyer_win_bonus: u64,
    #[serde(default)]
    pub points_from_referrals: u64,
    #[serde(default)]
    pub updated_at: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
struct InviteCodeKey([u8; INVITE_CODE_LENGTH]);

impl InviteCodeKey {
    fn from_code(code: &str) -> Option<Self> {
        let normalized = normalize_invite_code(code)?;
        let bytes = normalized.as_bytes();
        let mut fixed = [0u8; INVITE_CODE_LENGTH];
        fixed.copy_from_slice(bytes);
        Some(Self(fixed))
    }

    fn to_code(self) -> String {
        String::from_utf8_lossy(&self.0).to_string()
    }
}

impl Storable for InviteCodeKey {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Borrowed(&self.0)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let mut fixed = [0u8; INVITE_CODE_LENGTH];
        fixed.copy_from_slice(&bytes);
        Self(fixed)
    }

    fn into_bytes(self) -> Vec<u8> {
        self.0.to_vec()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: INVITE_CODE_LENGTH as u32,
        is_fixed_size: true,
    };
}

pub fn award_points_safe(principal: Principal, points: u64, reason: PointsReason) {
    if points == 0 {
        return;
    }

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        award_points_internal(principal, points, reason);
    }));

    if result.is_err() {
        ic::log("Failed to award points - continuing without points update");
    }
}

pub fn get_points(principal: &Principal) -> PointsProfile {
    USER_POINTS
        .with_borrow(|p| p.get(principal).map(|cbor| cbor.0))
        .unwrap_or_default()
}

pub fn get_or_create_invite_code(principal: Principal, existing_code: Option<String>) -> String {
    if let Some(existing_key) = PRINCIPAL_INVITE_CODES.with_borrow(|codes| codes.get(&principal)) {
        return existing_key.to_code();
    }

    if let Some(existing) = existing_code {
        if try_register_invite_code(&existing, principal) {
            return existing.to_ascii_uppercase();
        }
    }

    for attempt in 0u32..u32::MAX {
        let candidate = generate_invite_code(principal, attempt);
        if try_register_invite_code(&candidate, principal) {
            return candidate;
        }
    }

    // This fallback should be unreachable because the keyspace is large.
    ic::log("Invite code generation exhausted attempts, using deterministic fallback");
    generate_invite_code(principal, u32::MAX)
}

pub fn resolve_invite_code(code: &str) -> Option<Principal> {
    let key = InviteCodeKey::from_code(code)?;
    INVITE_CODE_REGISTRY.with_borrow(|registry| registry.get(&key))
}

pub fn get_invite_code_for_principal(principal: &Principal) -> Option<String> {
    if let Some(key) = PRINCIPAL_INVITE_CODES.with_borrow(|codes| codes.get(principal)) {
        return Some(key.to_code());
    }

    let recovered_key = INVITE_CODE_REGISTRY.with_borrow(|registry| {
        registry
            .iter()
            .find(|entry| entry.value() == *principal)
            .map(|entry| *entry.key())
    })?;

    PRINCIPAL_INVITE_CODES.with_borrow_mut(|codes| {
        codes.insert(*principal, recovered_key);
    });

    Some(recovered_key.to_code())
}

pub fn link_referrer_once(
    referred_principal: Principal,
    invite_code: Option<String>,
) -> Option<Principal> {
    let Some(code) = invite_code else {
        return None;
    };

    let Some(referrer_principal) = resolve_invite_code(&code) else {
        return None;
    };

    if referrer_principal == referred_principal {
        return None;
    }

    if let Some(existing_referrer) = get_referrer_for_principal(&referred_principal) {
        return Some(existing_referrer);
    }

    REFERRAL_LINKS.with_borrow_mut(|links| {
        links.insert(referred_principal, referrer_principal);
    });

    Some(referrer_principal)
}

pub fn get_referral_count(principal: &Principal) -> u64 {
    REFERRAL_LINKS.with_borrow(|links| {
        links
            .iter()
            .filter(|entry| entry.value() == *principal)
            .count() as u64
    })
}

fn award_points_internal(principal: Principal, points: u64, reason: PointsReason) {
    apply_points(principal, points, reason);

    if reason == PointsReason::ReferralBonus {
        return;
    }

    let points_config = Config::points_config();
    let referral_points = (points.saturating_mul(points_config.referral_basis_points)) / 10_000;
    if referral_points == 0 {
        return;
    }

    let Some(referrer_principal) = get_referrer_for_principal(&principal) else {
        return;
    };

    apply_points(
        referrer_principal,
        referral_points,
        PointsReason::ReferralBonus,
    );
}

fn apply_points(principal: Principal, points: u64, reason: PointsReason) {
    USER_POINTS.with_borrow_mut(|storage| {
        let mut profile = storage
            .get(&principal)
            .map(|cbor| cbor.0)
            .unwrap_or_default();
        profile.total_points = profile.total_points.saturating_add(points);

        match reason {
            PointsReason::OfferAcceptedBuyer => {
                profile.points_from_offer_accepted_buyer = profile
                    .points_from_offer_accepted_buyer
                    .saturating_add(points);
            }
            PointsReason::OfferAcceptedWriter => {
                profile.points_from_offer_accepted_writer = profile
                    .points_from_offer_accepted_writer
                    .saturating_add(points);
            }
            PointsReason::BuyerWinBonus => {
                profile.points_from_buyer_win_bonus =
                    profile.points_from_buyer_win_bonus.saturating_add(points);
            }
            PointsReason::ReferralBonus => {
                profile.points_from_referrals =
                    profile.points_from_referrals.saturating_add(points);
            }
        }

        profile.updated_at = ic::time();
        storage.insert(principal, Cbor(profile));
    });
}

fn get_referrer_for_principal(principal: &Principal) -> Option<Principal> {
    REFERRAL_LINKS.with_borrow(|links| links.get(principal))
}

fn try_register_invite_code(code: &str, principal: Principal) -> bool {
    let Some(key) = InviteCodeKey::from_code(code) else {
        return false;
    };

    if let Some(existing_key) = PRINCIPAL_INVITE_CODES.with_borrow(|codes| codes.get(&principal)) {
        if existing_key != key {
            return false;
        }

        return INVITE_CODE_REGISTRY.with_borrow_mut(|registry| {
            if let Some(existing_principal) = registry.get(&key) {
                return existing_principal == principal;
            }
            registry.insert(key, principal);
            true
        });
    }

    INVITE_CODE_REGISTRY.with_borrow_mut(|registry| {
        if let Some(existing_principal) = registry.get(&key) {
            if existing_principal != principal {
                return false;
            }
        } else {
            registry.insert(key, principal);
        }

        PRINCIPAL_INVITE_CODES.with_borrow_mut(|codes| {
            codes.insert(principal, key);
        });

        true
    })
}

fn generate_invite_code(principal: Principal, attempt: u32) -> String {
    let mut hasher = Sha256::new();
    hasher.update(principal.as_slice());
    hasher.update(attempt.to_be_bytes());
    let digest = hasher.finalize();

    let mut code = String::with_capacity(INVITE_CODE_LENGTH);
    for byte in digest.iter().take(INVITE_CODE_LENGTH) {
        let index = (*byte as usize) % INVITE_ALPHABET.len();
        code.push(INVITE_ALPHABET[index] as char);
    }
    code
}

fn normalize_invite_code(code: &str) -> Option<String> {
    let trimmed = code.trim().to_ascii_uppercase();

    if trimmed.len() != INVITE_CODE_LENGTH {
        return None;
    }

    if !trimmed
        .chars()
        .all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit())
    {
        return None;
    }

    Some(trimmed)
}

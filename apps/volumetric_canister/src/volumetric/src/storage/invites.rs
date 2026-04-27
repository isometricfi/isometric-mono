use std::borrow::Cow;
use std::cell::RefCell;

use candid::Principal;
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{StableBTreeMap, Storable};
use sha2::{Digest, Sha256};

use super::accounts::{get_profile, list_all_profiles, update_profile};
use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};
use crate::errors::{error_codes, VolumetricError};

const INVITE_CODE_LENGTH: usize = 6;
const INVITE_ALPHABET: &[u8; 36] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MAX_INVITE_CODE_GENERATION_ATTEMPTS: u32 = 32;

thread_local! {
    pub static INVITE_CODE_REGISTRY: RefCell<StableBTreeMap<InviteCodeKey, Principal, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::InviteCodeRegistryMemory as u8))),
        )
    );
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

pub fn get_or_create_invite_code(principal: Principal) -> Option<String> {
    let mut profile = get_profile(&principal)?;

    if let Some(existing_code) = profile.invite_code.clone() {
        if try_register_invite_code(&existing_code, principal) {
            let normalized_code = existing_code.trim().to_ascii_uppercase();
            if profile.invite_code.as_deref() != Some(normalized_code.as_str()) {
                profile.invite_code = Some(normalized_code.clone());
                update_profile(principal, profile);
            }
            return Some(normalized_code);
        }
    }

    for attempt in 0..MAX_INVITE_CODE_GENERATION_ATTEMPTS {
        let candidate = generate_invite_code(principal, attempt);
        if try_register_invite_code(&candidate, principal) {
            profile.invite_code = Some(candidate.clone());
            update_profile(principal, profile);
            return Some(candidate);
        }
    }

    logging::warn!("invite code generation exhausted bounded attempts");
    None
}

pub fn resolve_invite_code(code: &str) -> Option<Principal> {
    let key = InviteCodeKey::from_code(code)?;
    INVITE_CODE_REGISTRY.with_borrow(|registry| registry.get(&key))
}

pub fn validate_invite_code_for_principal(
    invite_code: Option<&str>,
    referred_principal: Principal,
) -> Result<Option<Principal>, VolumetricError> {
    let Some(invite_code) = invite_code else {
        return Ok(None);
    };

    let Some(referrer_principal) = resolve_invite_code(invite_code) else {
        return Err(VolumetricError::from_def(
            error_codes::INVALID_INVITE_CODE,
            Some("Invite code does not resolve to an account"),
            None,
        ));
    };

    if referrer_principal == referred_principal {
        return Err(VolumetricError::from_def(
            error_codes::INVALID_INVITE_CODE,
            Some("Invite code cannot refer the registering account"),
            None,
        ));
    }

    if get_profile(&referrer_principal).is_none() {
        return Err(VolumetricError::from_def(
            error_codes::INVALID_INVITE_CODE,
            Some("Invite code owner profile is missing"),
            None,
        ));
    }

    Ok(Some(referrer_principal))
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

    let mut profile = get_profile(&referred_principal)?;

    if let Some(existing_referrer) = profile.referred_by {
        return Some(existing_referrer);
    }

    profile.referred_by = Some(referrer_principal);
    update_profile(referred_principal, profile);

    Some(referrer_principal)
}

pub fn get_referral_count(principal: &Principal) -> u64 {
    list_all_profiles()
        .into_iter()
        .filter(|(_, profile)| profile.referred_by.as_ref() == Some(principal))
        .count() as u64
}

fn try_register_invite_code(code: &str, principal: Principal) -> bool {
    let Some(key) = InviteCodeKey::from_code(code) else {
        return false;
    };

    INVITE_CODE_REGISTRY.with_borrow_mut(|registry| {
        if let Some(existing_principal) = registry.get(&key) {
            return existing_principal == principal;
        }

        registry.insert(key, principal);
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

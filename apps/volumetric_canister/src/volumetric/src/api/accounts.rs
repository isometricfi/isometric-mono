use candid::Principal;
use ic_cdk::api;
use sha2::{Digest, Sha256};

use crate::auth::types::{
    AuthenticatedPayload, ChallengeContext, CreateProfileRequest, SignableAction,
    UpdateUsernameRequest, WalletKey,
};
use crate::auth::{derive_principal, derive_subaccount, verify_btc_signature};
use crate::errors::VolumetricError;
use crate::storage::{
    create_profile, get_nonce, get_principal_for_wallet, get_profile, increment_nonce,
    is_wallet_registered, list_all_profiles, register_wallet, update_profile, Profile,
};

const BTC_NETWORK_LABEL: &str = "mainnet";

#[derive(candid::CandidType, serde::Serialize, serde::Deserialize)]
pub struct ProfileInfo {
    pub principal: Principal,
    pub subaccount: Vec<u8>,
    pub address: String,
    pub username: Option<String>,
}

#[derive(candid::CandidType, serde::Serialize, serde::Deserialize)]
pub struct UserInfo {
    pub principal: Principal,
    pub address: String,
    pub username: Option<String>,
}

#[ic_cdk::update]
pub fn create_account(
    req: AuthenticatedPayload<CreateProfileRequest>,
) -> Result<ProfileInfo, VolumetricError> {
    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::from_address(address);

    if is_wallet_registered(&wallet_key) {
        return Err(VolumetricError::ProfileAlreadyRegistered);
    }

    let context = build_context(&wallet_key);
    let message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let principal = derive_principal(address);
    let subaccount = derive_subaccount(principal);

    let profile = Profile {
        wallet_address: address.clone(),
        username: None,
        created_at: ic_cdk::api::time(),
    };

    create_profile(principal, profile);
    register_wallet(wallet_key, principal);

    Ok(ProfileInfo {
        principal,
        subaccount: subaccount.to_vec(),
        address: address.clone(),
        username: None,
    })
}

#[ic_cdk::query]
pub fn get_account_nonce(address: String) -> u64 {
    let wallet_key = WalletKey::from_address(&address);
    get_nonce(&wallet_key)
}

#[ic_cdk::query]
pub fn get_account_info(address: String) -> Option<ProfileInfo> {
    let wallet_key = WalletKey::from_address(&address);
    let principal = get_principal_for_wallet(&wallet_key)?;
    let subaccount = derive_subaccount(principal);
    let profile = get_profile(&principal)?;

    Some(ProfileInfo {
        principal,
        subaccount: subaccount.to_vec(),
        address,
        username: profile.username,
    })
}

#[ic_cdk::query]
pub fn get_message_to_sign(address: String) -> String {
    let wallet_key = WalletKey::from_address(&address);
    let context = build_context(&wallet_key);
    let req = CreateProfileRequest {};
    req.signing_message(&address, &context)
}

#[ic_cdk::query]
pub fn get_username_update_message(address: String, username: String) -> String {
    let wallet_key = WalletKey::from_address(&address);
    let context = build_context(&wallet_key);
    let req = UpdateUsernameRequest { username };
    req.signing_message(&address, &context)
}

#[ic_cdk::update]
pub fn update_username(
    req: AuthenticatedPayload<UpdateUsernameRequest>,
) -> Result<ProfileInfo, VolumetricError> {
    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::from_address(address);

    let principal =
        get_principal_for_wallet(&wallet_key).ok_or(VolumetricError::ProfileNotFound)?;

    let mut profile = get_profile(&principal).ok_or(VolumetricError::ProfileNotFound)?;

    let context = build_context(&wallet_key);
    let message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    profile.username = Some(req.data.username);
    update_profile(principal, profile.clone());

    let subaccount = derive_subaccount(principal);

    Ok(ProfileInfo {
        principal,
        subaccount: subaccount.to_vec(),
        address: address.clone(),
        username: profile.username,
    })
}

#[ic_cdk::query]
pub fn list_users() -> Vec<UserInfo> {
    list_all_profiles()
        .into_iter()
        .map(|(principal, profile)| UserInfo {
            principal,
            address: profile.wallet_address,
            username: profile.username,
        })
        .collect()
}

fn build_context(wallet_key: &WalletKey) -> ChallengeContext {
    let nonce = get_nonce(wallet_key);

    ChallengeContext {
        canister_id_hash: hash_canister_id(api::canister_self()),
        network: BTC_NETWORK_LABEL,
        nonce,
    }
}

fn hash_canister_id(canister_id: Principal) -> String {
    let digest = Sha256::digest(canister_id.as_slice());
    let mut out = String::with_capacity(digest.len() * 2);
    for b in digest {
        use core::fmt::Write;
        let _ = write!(&mut out, "{:02x}", b);
    }
    out
}

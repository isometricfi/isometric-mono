use candid::Principal;
use ic_cdk::api;

use crate::auth::types::{
    AuthenticatedPayload, ChallengeContext, CreateProfileRequest, SignableAction,
    UpdateUsernameRequest, WalletKey,
};
use crate::auth::{derive_principal, derive_subaccount, verify_btc_signature};
use crate::errors::VolumetricError;
use crate::guards::is_whitelisted;
use crate::storage::{
    create_profile, get_nonce, get_principal_for_wallet, get_profile, increment_nonce,
    is_wallet_registered, list_all_profiles, register_wallet, update_profile, BtcNetwork, Config,
    Profile,
};

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
pub async fn create_account(
    req: AuthenticatedPayload<CreateProfileRequest>,
) -> Result<ProfileInfo, VolumetricError> {
    is_whitelisted().await?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::from_address(address);

    if is_wallet_registered(&wallet_key) {
        return Err(VolumetricError::profile_already_registered());
    }

    let context = build_challenge_context(&wallet_key);
    let reconstructed_message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

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
    let context = build_challenge_context(&wallet_key);
    let req = CreateProfileRequest {};
    req.signing_message(&address, &context)
}

#[ic_cdk::query]
pub fn get_username_update_message(address: String, username: String) -> String {
    let wallet_key = WalletKey::from_address(&address);
    let context = build_challenge_context(&wallet_key);
    let req = UpdateUsernameRequest { username };
    req.signing_message(&address, &context)
}

#[ic_cdk::update]
pub async fn update_username(
    req: AuthenticatedPayload<UpdateUsernameRequest>,
) -> Result<ProfileInfo, VolumetricError> {
    is_whitelisted().await?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::from_address(address);

    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    let mut profile = get_profile(&principal).ok_or_else(VolumetricError::profile_not_found)?;

    let context = build_challenge_context(&wallet_key);
    let reconstructed_message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

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

pub fn build_challenge_context(wallet_key: &WalletKey) -> ChallengeContext {
    let nonce = get_nonce(wallet_key);
    let network = match Config::btc_network() {
        BtcNetwork::Mainnet => "mainnet",
        BtcNetwork::Testnet => "testnet",
    };

    ChallengeContext {
        canister_id: api::canister_self().to_text(),
        network,
        nonce,
    }
}

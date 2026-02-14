use candid::Principal;

use crate::auth::types::{
    AuthenticatedPayload, CreateProfileRequest, SignableAction, UpdateUsernameRequest, WalletKey,
};
use crate::auth::{build_challenge_context, verify_btc_signature};
use crate::errors::VolumetricError;
use crate::guards::is_whitelisted;
use crate::storage::{get_nonce, get_principal_for_wallet, increment_nonce, is_wallet_registered};
use crate::usecases;

#[derive(Debug, candid::CandidType, serde::Serialize, serde::Deserialize)]
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

    let params = usecases::RegisterAccountParams {
        wallet_address: address.clone(),
    };
    let result = usecases::register_account_use_case(params);

    Ok(ProfileInfo {
        principal: result.principal,
        subaccount: result.subaccount.to_vec(),
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
    let info = usecases::get_account_info_use_case(address)?;
    Some(ProfileInfo {
        principal: info.principal,
        subaccount: info.subaccount.to_vec(),
        address: info.address,
        username: info.username,
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

    let context = build_challenge_context(&wallet_key);
    let reconstructed_message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let result = usecases::update_username_use_case(principal, req.data.username)
        .ok_or_else(VolumetricError::profile_not_found)?;

    Ok(ProfileInfo {
        principal: result.principal,
        subaccount: result.subaccount.to_vec(),
        address: address.clone(),
        username: result.username,
    })
}

#[ic_cdk::query]
pub fn list_users() -> Vec<UserInfo> {
    usecases::list_users_use_case()
        .into_iter()
        .map(|u| UserInfo {
            principal: u.principal,
            address: u.address,
            username: u.username,
        })
        .collect()
}

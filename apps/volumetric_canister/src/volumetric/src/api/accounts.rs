use candid::Principal;

use crate::auth::types::{
    AuthenticatedPayload, CreateProfileRequest, SignableAction, UpdateUsernameRequest, WalletKey,
};
use crate::auth::{build_challenge_context, verify_btc_signature};
use crate::errors::{error_codes, VolumetricError};
use crate::guards::is_whitelisted;
use crate::storage::{
    get_invite_code_for_principal, get_nonce, get_principal_for_wallet, get_profile,
    get_referral_count as get_referrals_for_principal, increment_nonce, is_wallet_registered,
    resolve_invite_code as resolve_invite_to_principal,
};
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
pub fn create_account(
    req: AuthenticatedPayload<CreateProfileRequest>,
) -> Result<ProfileInfo, VolumetricError> {
    is_whitelisted()?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::try_from_address(address)?;

    if is_wallet_registered(&wallet_key) {
        return Err(VolumetricError::from_def(
            error_codes::PROFILE_ALREADY_REGISTERED,
            None,
            None,
        ));
    }

    let context = build_challenge_context(&wallet_key);
    let reconstructed_message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let params = usecases::RegisterAccountParams {
        wallet_address: address.clone(),
        invite_code: req.data.invite_code.clone(),
    };
    let result = usecases::register_account_use_case(params)?;

    Ok(ProfileInfo {
        principal: result.principal,
        subaccount: result.subaccount.to_vec(),
        address: address.clone(),
        username: None,
    })
}

#[ic_cdk::query]
pub fn get_account_nonce(address: String) -> Result<u64, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&address)?;
    Ok(get_nonce(&wallet_key))
}

#[ic_cdk::query]
pub fn get_account_info(address: String) -> Result<Option<ProfileInfo>, VolumetricError> {
    let info = usecases::get_account_info_use_case(address)?;
    Ok(info.map(|info| ProfileInfo {
        principal: info.principal,
        subaccount: info.subaccount.to_vec(),
        address: info.address,
        username: info.username,
    }))
}

#[ic_cdk::query]
pub fn get_message_to_sign(address: String) -> Result<String, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&address)?;
    let context = build_challenge_context(&wallet_key);
    let req = CreateProfileRequest {};
    Ok(req.signing_message(&address, &context))
}

#[ic_cdk::query]
pub fn get_username_update_message(
    address: String,
    username: String,
) -> Result<String, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&address)?;
    let context = build_challenge_context(&wallet_key);
    let req = UpdateUsernameRequest { username };
    Ok(req.signing_message(&address, &context))
}

#[ic_cdk::update]
pub fn update_username(
    req: AuthenticatedPayload<UpdateUsernameRequest>,
) -> Result<ProfileInfo, VolumetricError> {
    is_whitelisted()?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::try_from_address(address)?;

    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    let context = build_challenge_context(&wallet_key);
    let reconstructed_message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let result = usecases::update_username_use_case(principal, req.data.username)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

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

#[ic_cdk::query]
pub fn get_invite_code(address: String) -> Option<String> {
    let wallet_key = WalletKey::from_address(&address);
    let principal = get_principal_for_wallet(&wallet_key)?;
    get_invite_code_for_principal(&principal)
}

#[ic_cdk::query]
pub fn resolve_invite_code(code: String) -> Option<String> {
    let principal = resolve_invite_to_principal(&code)?;
    let profile = get_profile(&principal)?;
    Some(profile.wallet_address)
}

#[ic_cdk::query]
pub fn get_referral_count(address: String) -> Option<u64> {
    let wallet_key = WalletKey::from_address(&address);
    let principal = get_principal_for_wallet(&wallet_key)?;
    Some(get_referrals_for_principal(&principal))
}

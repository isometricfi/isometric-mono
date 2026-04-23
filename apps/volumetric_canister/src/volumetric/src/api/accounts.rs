use candid::Principal;

use crate::auth::types::{
    AuthenticatedPayload, CreateProfileRequest, UpdateUsernameRequest, WalletKey,
};
use crate::auth::{
    build_challenge_context, build_challenge_message, derive_principal, ensure_challenge_fresh,
    verify_btc_signature,
};
use crate::errors::{error_codes, VolumetricError};
use crate::guards::is_whitelisted;
use crate::storage::{
    get_nonce, get_principal_for_wallet, get_profile, increment_nonce, is_wallet_registered,
    resolve_invite_code as resolve_invite_to_principal, validate_invite_code_for_principal,
};
use crate::usecases;

#[derive(Debug, candid::CandidType, serde::Serialize, serde::Deserialize)]
pub struct ProfileInfo {
    pub principal: Principal,
    pub subaccount: Vec<u8>,
    pub address: String,
    pub username: Option<String>,
    pub invite_code: Option<String>,
    pub referral_count: Option<u64>,
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

    ensure_challenge_fresh(req.data.expires_at_seconds)?;

    let context = build_challenge_context(&wallet_key, req.data.expires_at_seconds);
    let reconstructed_message = build_challenge_message(&req.data, address, &context)?;

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    validate_invite_code_for_account_creation(req.data.invite_code.as_deref(), address)?;
    increment_nonce(&wallet_key);

    let params = usecases::RegisterAccountParams {
        wallet_address: address.clone(),
        invite_code: req.data.invite_code.clone(),
    };
    let result = usecases::register_account_use_case(params)?;

    Ok(build_profile_info(
        result.principal,
        result.subaccount.to_vec(),
        address.clone(),
        None,
        result.invite_code,
        Some(0),
    ))
}

#[ic_cdk::query]
pub fn get_account_nonce(address: String) -> Result<u64, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&address)?;
    Ok(get_nonce(&wallet_key))
}

#[ic_cdk::query]
pub fn get_account_info(
    address: String,
    include_referral_count: bool,
) -> Result<Option<ProfileInfo>, VolumetricError> {
    let info = usecases::get_account_info_use_case(address, include_referral_count)?;
    Ok(info.map(|info| ProfileInfo {
        principal: info.principal,
        subaccount: info.subaccount.to_vec(),
        address: info.address,
        username: info.username,
        invite_code: info.invite_code,
        referral_count: info.referral_count,
    }))
}

#[ic_cdk::query]
pub fn get_message_to_sign(
    address: String,
    invite_code: Option<String>,
    expires_at_seconds: u64,
) -> Result<String, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&address)?;
    let context = build_challenge_context(&wallet_key, expires_at_seconds);
    let req = CreateProfileRequest {
        invite_code,
        expires_at_seconds,
    };
    build_challenge_message(&req, &address, &context)
}

#[ic_cdk::query]
pub fn get_username_update_message(
    address: String,
    username: String,
    expires_at_seconds: u64,
) -> Result<String, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&address)?;
    let context = build_challenge_context(&wallet_key, expires_at_seconds);
    let req = UpdateUsernameRequest {
        username,
        expires_at_seconds,
    };
    build_challenge_message(&req, &address, &context)
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

    ensure_challenge_fresh(req.data.expires_at_seconds)?;

    let context = build_challenge_context(&wallet_key, req.data.expires_at_seconds);
    let reconstructed_message = build_challenge_message(&req.data, address, &context)?;

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let result = usecases::update_username_use_case(principal, req.data.username)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    let account_info = usecases::get_account_info_use_case(address.clone(), true)?
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    Ok(build_profile_info(
        result.principal,
        result.subaccount.to_vec(),
        address.clone(),
        result.username,
        account_info.invite_code,
        account_info.referral_count,
    ))
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
pub fn resolve_invite_code(code: String) -> Option<String> {
    let principal = resolve_invite_to_principal(&code)?;
    let profile = get_profile(&principal)?;
    Some(profile.wallet_address)
}

#[ic_cdk::query]
pub fn validate_invite_code(code: String, address: String) -> bool {
    validate_invite_code_for_account_creation(Some(&code), &address).is_ok()
}

fn build_profile_info(
    principal: Principal,
    subaccount: Vec<u8>,
    address: String,
    username: Option<String>,
    invite_code: Option<String>,
    referral_count: Option<u64>,
) -> ProfileInfo {
    ProfileInfo {
        principal,
        subaccount,
        address,
        username,
        invite_code,
        referral_count,
    }
}

fn validate_invite_code_for_account_creation(
    invite_code: Option<&str>,
    wallet_address: &str,
) -> Result<(), VolumetricError> {
    let Some(invite_code) = invite_code else {
        return Ok(());
    };

    let _ = WalletKey::try_from_address(wallet_address)?;
    let referred_principal = derive_principal(wallet_address);
    validate_invite_code_for_principal(Some(invite_code), referred_principal)?;
    Ok(())
}

use candid::Decode;

use volumetric::auth::types::WalletProof;
use volumetric::{AuthenticatedPayload, CreateProfileRequest, ProfileInfo, VolumetricError};

use crate::common::{wallets, TestEnv, TestWallet};

const SIGNING_WINDOW_SECONDS: u64 = 300;

fn expires_at_seconds(env: &TestEnv) -> u64 {
    env.get_time_ns() / 1_000_000_000 + SIGNING_WINDOW_SECONDS
}

pub fn get_signing_message(
    env: &TestEnv,
    address: &str,
    invite_code: Option<String>,
    expires_at_seconds: u64,
) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_message_to_sign",
            candid::encode_args((address.to_string(), invite_code, expires_at_seconds)).unwrap(),
        )
        .expect("Query failed");

    let result_message: Result<String, VolumetricError> =
        Decode!(&response, Result<String, VolumetricError>).unwrap();
    result_message.expect("Failed to build account signing message")
}

pub fn create_account(env: &TestEnv, wallet: &TestWallet) -> Result<ProfileInfo, VolumetricError> {
    create_account_with_invite(env, wallet, None)
}

pub fn create_account_with_invite(
    env: &TestEnv,
    wallet: &TestWallet,
    invite_code: Option<String>,
) -> Result<ProfileInfo, VolumetricError> {
    let expires_at = expires_at_seconds(env);
    let message = get_signing_message(env, &wallet.address, invite_code.clone(), expires_at);
    let signature = wallets::sign_message(wallet, &message);
    create_account_with_signature(env, wallet, &signature, invite_code, expires_at)
}

pub fn create_account_with_signature(
    env: &TestEnv,
    wallet: &TestWallet,
    signature: &str,
    invite_code: Option<String>,
    expires_at_seconds: u64,
) -> Result<ProfileInfo, VolumetricError> {
    let payload = AuthenticatedPayload {
        data: CreateProfileRequest {
            invite_code,
            expires_at_seconds,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature: signature.to_string(),
        },
    };

    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "create_account",
            candid::encode_one(payload).unwrap(),
        )
        .expect("Update call failed");

    Decode!(&response, Result<ProfileInfo, VolumetricError>).unwrap()
}

pub fn get_account_info(
    env: &TestEnv,
    address: &str,
    include_referral_count: bool,
) -> Option<ProfileInfo> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_account_info",
            candid::encode_args((address.to_string(), include_referral_count)).unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, Result<Option<ProfileInfo>, VolumetricError>)
        .unwrap()
        .expect("Failed to fetch account info")
}

pub fn resolve_invite_code(env: &TestEnv, invite_code: &str) -> Option<String> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "resolve_invite_code",
            candid::encode_one(invite_code.to_string()).unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, Option<String>).unwrap()
}

pub fn validate_invite_code(env: &TestEnv, invite_code: &str, address: &str) -> bool {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "validate_invite_code",
            candid::encode_args((invite_code.to_string(), address.to_string())).unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, bool).unwrap()
}

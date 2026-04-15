use candid::Decode;

use volumetric::auth::types::WalletProof;
use volumetric::{AuthenticatedPayload, CreateProfileRequest, ProfileInfo, VolumetricError};

use crate::common::{wallets, TestEnv, TestWallet};

pub fn get_signing_message(env: &TestEnv, address: &str) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_message_to_sign",
            candid::encode_one(address.to_string()).unwrap(),
        )
        .expect("Query failed");
    if let Ok(message) = Decode!(&response, String) {
        return message;
    }

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
    let message = get_signing_message(env, &wallet.address);
    let signature = wallets::sign_message(wallet, &message);
    create_account_with_signature(env, &wallet.address, &signature, invite_code)
}

pub fn create_account_with_signature(
    env: &TestEnv,
    address: &str,
    signature: &str,
    invite_code: Option<String>,
) -> Result<ProfileInfo, VolumetricError> {
    let payload = AuthenticatedPayload {
        data: CreateProfileRequest { invite_code },
        wallet_proof: WalletProof {
            address: address.to_string(),
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

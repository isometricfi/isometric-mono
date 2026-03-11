use candid::Decode;

use volumetric::auth::types::WalletProof;
use volumetric::{AuthenticatedPayload, CreateProfileRequest, ProfileInfo, VolumetricError};

use crate::common::{wallets, TestEnv, TestWallet};

pub fn get_signing_message(env: &TestEnv, address: &str, invite_code: Option<String>) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_message_to_sign",
            candid::encode_args((address.to_string(), invite_code)).unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, String).unwrap()
}

pub fn create_account(env: &TestEnv, wallet: &TestWallet) -> Result<ProfileInfo, VolumetricError> {
    create_account_with_invite(env, wallet, None)
}

pub fn create_account_with_invite(
    env: &TestEnv,
    wallet: &TestWallet,
    invite_code: Option<String>,
) -> Result<ProfileInfo, VolumetricError> {
    let message = get_signing_message(env, &wallet.address, invite_code.clone());
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

pub fn get_invite_code(env: &TestEnv, address: &str) -> Option<String> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_invite_code",
            candid::encode_one(address.to_string()).unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, Option<String>).unwrap()
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

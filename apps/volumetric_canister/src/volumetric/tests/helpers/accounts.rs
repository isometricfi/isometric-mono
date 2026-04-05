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
    let message = get_signing_message(env, &wallet.address);
    let signature = wallets::sign_message(wallet, &message);
    create_account_with_signature(env, &wallet.address, &signature)
}

pub fn create_account_with_signature(
    env: &TestEnv,
    address: &str,
    signature: &str,
) -> Result<ProfileInfo, VolumetricError> {
    let payload = AuthenticatedPayload {
        data: CreateProfileRequest {},
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

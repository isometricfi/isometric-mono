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
    Decode!(&response, String).unwrap()
}

pub fn create_account(env: &TestEnv, wallet: &TestWallet) -> Result<ProfileInfo, VolumetricError> {
    let message = get_signing_message(env, &wallet.address);
    let signature = wallets::sign_message(wallet, &message);

    let payload = AuthenticatedPayload {
        data: CreateProfileRequest {},
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
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

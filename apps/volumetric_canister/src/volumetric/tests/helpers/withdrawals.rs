use candid::Decode;

use volumetric::auth::types::WalletProof;
use volumetric::journaling::OperationId;
use volumetric::{
    AuthenticatedPayload, VolumetricError, WithdrawCkbtcRequest, WithdrawReceipt, WithdrawStatus,
};

use crate::common::{wallets, TestEnv, TestWallet};

const SIGNING_WINDOW_SECONDS: u64 = 300;

fn expires_at_seconds(env: &TestEnv) -> u64 {
    env.get_time_ns() / 1_000_000_000 + SIGNING_WINDOW_SECONDS
}

pub fn get_withdraw_message(
    env: &TestEnv,
    address: &str,
    amount_sats: u64,
    expires_at_seconds: u64,
) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_withdraw_message",
            candid::encode_args((address.to_string(), amount_sats, expires_at_seconds)).unwrap(),
        )
        .expect("Query failed");

    let result_message: Result<String, VolumetricError> =
        Decode!(&response, Result<String, VolumetricError>).unwrap();
    result_message.expect("Failed to build withdraw signing message")
}

pub fn withdraw_ckbtc(
    env: &TestEnv,
    wallet: &TestWallet,
    amount_sats: u64,
) -> Result<WithdrawReceipt, VolumetricError> {
    let expires_at = expires_at_seconds(env);
    let message = get_withdraw_message(env, &wallet.address, amount_sats, expires_at);
    let signature = wallets::sign_message(wallet, &message);

    let payload = AuthenticatedPayload {
        data: WithdrawCkbtcRequest {
            amount: amount_sats,
            expires_at_seconds: expires_at,
        },
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
            "withdraw_ckbtc",
            candid::encode_one(payload).unwrap(),
        )
        .expect("Update call failed");

    Decode!(&response, Result<WithdrawReceipt, VolumetricError>).unwrap()
}

pub fn get_withdraw_status(
    env: &TestEnv,
    operation_id: OperationId,
) -> Result<WithdrawStatus, VolumetricError> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_withdraw_status",
            candid::encode_one(operation_id).unwrap(),
        )
        .expect("Query failed");

    Decode!(&response, Result<WithdrawStatus, VolumetricError>).unwrap()
}

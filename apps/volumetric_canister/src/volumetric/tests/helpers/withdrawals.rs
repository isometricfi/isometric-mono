use candid::Decode;

use volumetric::auth::types::WalletProof;
use volumetric::journaling::OperationId;
use volumetric::{
    AuthenticatedPayload, VolumetricError, WithdrawCkbtcRequest, WithdrawReceipt, WithdrawStatus,
};

use crate::common::{wallets, TestEnv, TestWallet};

pub fn get_withdraw_message(
    env: &TestEnv,
    address: &str,
    btc_address: &str,
    amount_sats: u64,
) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_withdraw_message",
            candid::encode_args((address.to_string(), btc_address.to_string(), amount_sats))
                .unwrap(),
        )
        .expect("Query failed");
    if let Ok(message) = Decode!(&response, String) {
        return message;
    }

    let result_message: Result<String, VolumetricError> =
        Decode!(&response, Result<String, VolumetricError>).unwrap();
    result_message.expect("Failed to build withdraw signing message")
}

pub fn withdraw_ckbtc(
    env: &TestEnv,
    wallet: &TestWallet,
    btc_address: &str,
    amount_sats: u64,
) -> Result<WithdrawReceipt, VolumetricError> {
    let message = get_withdraw_message(env, &wallet.address, btc_address, amount_sats);
    let signature = wallets::sign_message(wallet, &message);

    let payload = AuthenticatedPayload {
        data: WithdrawCkbtcRequest {
            btc_address: btc_address.to_string(),
            amount: amount_sats,
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

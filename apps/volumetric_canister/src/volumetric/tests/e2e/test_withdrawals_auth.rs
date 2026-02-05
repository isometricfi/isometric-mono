use candid::Decode;

use crate::common::{create_test_env, generate_wallet, wallets};
use crate::helpers::{create_account, whitelist_controller};
use volumetric::auth::types::WalletProof;
use volumetric::errors::error_codes;
use volumetric::{
    AuthenticatedPayload, PendingWithdrawal, PendingWithdrawalsRequest, VolumetricError,
};

/// Given: Authenticated wallet signs pending-withdrawals message
/// When: Same signed payload is replayed
/// Then: First call succeeds and replay fails due nonce/signature mismatch
#[test]
fn test_get_my_pending_withdrawals_requires_fresh_signed_payload() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);

    const WALLET_SEED: u64 = 51;
    let wallet = generate_wallet(WALLET_SEED);
    create_account(&env, &wallet).expect("Account creation failed");

    let message_response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_my_pending_withdrawals_message",
            candid::encode_one(wallet.address.clone()).unwrap(),
        )
        .expect("Message query failed");
    let message: String = Decode!(&message_response, String).expect("Message decode failed");
    let signature = wallets::sign_message(&wallet, &message);

    let payload = AuthenticatedPayload {
        data: PendingWithdrawalsRequest::default(),
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
        },
    };

    // when
    let first_response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "get_my_pending_withdrawals",
            candid::encode_one(payload.clone()).unwrap(),
        )
        .expect("First call failed");
    let first_result: Result<Vec<PendingWithdrawal>, VolumetricError> = Decode!(
        &first_response,
        Result<Vec<PendingWithdrawal>, VolumetricError>
    )
    .unwrap();

    let replay_response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "get_my_pending_withdrawals",
            candid::encode_one(payload).unwrap(),
        )
        .expect("Replay call failed");
    let replay_result: Result<Vec<PendingWithdrawal>, VolumetricError> = Decode!(
        &replay_response,
        Result<Vec<PendingWithdrawal>, VolumetricError>
    )
    .unwrap();

    // then
    assert!(first_result
        .expect("First signed call should succeed")
        .is_empty());
    let replay_error = replay_result.expect_err("Replay should fail due stale nonce");
    assert_eq!(replay_error.code, error_codes::INVALID_SIGNATURE.code);
}

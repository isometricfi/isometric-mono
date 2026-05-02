//! Attack-vector tests for the canister-layer binding of signed requests.
//!
//! The verifier's unit tests cover individual cryptographic primitives. This
//! file covers what happens when the verifier is wired to the canister's
//! nonce / expiry / canonical-message / address-binding machinery — i.e.,
//! replay, impersonation, and tampering scenarios that only manifest at the
//! public API boundary.

use candid::Decode;

use volumetric::auth::types::WalletProof;
use volumetric::errors::error_codes;
use volumetric::{
    AuthenticatedPayload, CancelOfferRequest, Offer, VolumetricError, WithdrawCkbtcRequest,
    WithdrawReceipt,
};

use crate::common::{create_test_env, generate_wallet, wallets, TestEnv};
use crate::helpers::{
    configure_test_ledger, create_account, mint_and_sync_balance, whitelist_controller,
};
use crate::helpers::{offers, withdrawals};

const SIGNING_WINDOW_SECONDS: u64 = 300;
const INITIAL_BALANCE_SATS: u64 = 500_000;
const WITHDRAW_AMOUNT_SATS: u64 = 100_000;
const OFFER_QUANTITY_SATS: u64 = 100_000;
const OFFER_STRIKE_BPS: u16 = 500;
const OFFER_PREMIUM_BPS: u16 = 100;
const OFFER_DURATION_SECS: u64 = 86_400 * 3;
const ONE_HOUR_NS: u64 = 3_600_000_000_000;

fn expires_at(env: &TestEnv) -> u64 {
    env.get_time_ns() / 1_000_000_000 + SIGNING_WINDOW_SECONDS
}

fn call_withdraw(
    env: &TestEnv,
    payload: AuthenticatedPayload<WithdrawCkbtcRequest>,
) -> Result<WithdrawReceipt, VolumetricError> {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "withdraw_ckbtc",
            candid::encode_one(payload).unwrap(),
        )
        .expect("update call failed");
    Decode!(&response, Result<WithdrawReceipt, VolumetricError>).unwrap()
}

fn call_cancel_offer(
    env: &TestEnv,
    payload: AuthenticatedPayload<CancelOfferRequest>,
) -> Result<Offer, VolumetricError> {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "cancel_offer",
            candid::encode_one(payload).unwrap(),
        )
        .expect("update call failed");
    Decode!(&response, Result<Offer, VolumetricError>).unwrap()
}

// ======================================================================
// I. Cross-action replay
// ======================================================================

/// Given: a user has signed a valid `create_offer` challenge
/// When: the attacker submits that exact signature to `cancel_offer`
/// Then: the canister rebuilds the challenge with `action=cancel_offer`,
///       the signature fails to verify, and the call is rejected.
#[test]
fn test_cross_action_replay_create_offer_signature_rejected_on_cancel_offer() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WALLET_SEED: u64 = 101;
    let wallet = generate_wallet(WALLET_SEED);
    let profile = create_account(&env, &wallet).expect("register");
    mint_and_sync_balance(&env, &profile, OFFER_QUANTITY_SATS).expect("fund");

    let expires_at_seconds = expires_at(&env);
    let valid_until = env.get_time_ns() + ONE_HOUR_NS;
    let create_offer_message = offers::get_create_offer_message(
        &env,
        &wallet.address,
        OFFER_QUANTITY_SATS,
        OFFER_STRIKE_BPS,
        OFFER_PREMIUM_BPS,
        OFFER_DURATION_SECS,
        valid_until,
        expires_at_seconds,
    );
    let create_offer_signature = wallets::sign_message(&wallet, &create_offer_message);

    // when
    const ARBITRARY_OFFER_ID_TO_ATTACK: u64 = 42;
    let cancel_payload = AuthenticatedPayload {
        data: CancelOfferRequest {
            offer_id: ARBITRARY_OFFER_ID_TO_ATTACK,
            expires_at_seconds,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature: create_offer_signature,
        },
    };
    let result = call_cancel_offer(&env, cancel_payload);

    // then
    let err = result.expect_err("cross-action replay must be rejected");
    assert_eq!(
        err.code,
        error_codes::INVALID_SIGNATURE.code,
        "expected INVALID_SIGNATURE, got {:?}",
        err
    );
}

// ======================================================================
// J. Cross-address replay (signature bound to its signing address)
// ======================================================================

/// Given: a signed `withdraw_ckbtc` proof made for address A1
/// When: an attacker re-submits with `wallet_proof.address` set to an
///       unrelated address A2 (a different registered user)
/// Then: canister rebuilds the challenge using A2's nonce and `address=A2`,
///       the BIP-322 signature cannot verify under A2's scriptPubKey, and
///       the call is rejected. Proves that `address=` in the canonical
///       message plus wallet-proof-scoped signing prevent cross-address
///       replay even with a fully controlled client.
#[test]
fn test_cross_address_replay_rejected_when_wallet_proof_address_mutated() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const SIGNER_SEED: u64 = 201;
    const DECOY_SEED: u64 = 202;
    let signer_wallet = generate_wallet(SIGNER_SEED);
    let decoy_wallet = generate_wallet(DECOY_SEED);

    let signer_profile = create_account(&env, &signer_wallet).expect("register signer");
    create_account(&env, &decoy_wallet).expect("register decoy");
    mint_and_sync_balance(&env, &signer_profile, INITIAL_BALANCE_SATS).expect("fund signer");

    let expires_at_seconds = expires_at(&env);
    let message = withdrawals::get_withdraw_message(
        &env,
        &signer_wallet.address,
        WITHDRAW_AMOUNT_SATS,
        expires_at_seconds,
    );
    let signer_signature = wallets::sign_message(&signer_wallet, &message);

    // when
    let mutated_payload = AuthenticatedPayload {
        data: WithdrawCkbtcRequest {
            amount: WITHDRAW_AMOUNT_SATS,
            expires_at_seconds,
        },
        wallet_proof: WalletProof {
            address: decoy_wallet.address.clone(),
            signature: signer_signature,
        },
    };
    let result = call_withdraw(&env, mutated_payload);

    // then
    let err = result.expect_err("mutated wallet_proof.address must be rejected");
    assert_eq!(
        err.code,
        error_codes::INVALID_SIGNATURE.code,
        "expected INVALID_SIGNATURE, got {:?}",
        err
    );
}

// ======================================================================
// K. Cross-user impersonation
// ======================================================================

/// Given: user B signs a valid withdraw for their own address
/// When: attacker submits with `wallet_proof.address = A` (a different user)
/// Then: canister reconstructs using A's nonce + address, signature doesn't
///       verify, call rejected.
///
/// This differs from J only in framing (the "attacker" is a legitimate
/// user B who wants to drain A's account), but it exercises the same
/// address-binding defense via a different code path: A is the victim and
/// the signature belongs to B. Covered because cross-user vs same-user
/// replays can accidentally diverge if address handling differs per call.
#[test]
fn test_cross_user_impersonation_rejected() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const VICTIM_SEED: u64 = 301;
    const ATTACKER_SEED: u64 = 302;
    let victim_wallet = generate_wallet(VICTIM_SEED);
    let attacker_wallet = generate_wallet(ATTACKER_SEED);

    let victim_profile = create_account(&env, &victim_wallet).expect("register victim");
    create_account(&env, &attacker_wallet).expect("register attacker");
    mint_and_sync_balance(&env, &victim_profile, INITIAL_BALANCE_SATS)
        .expect("fund victim balance attacker wants to steal");

    let expires_at_seconds = expires_at(&env);
    let attacker_message = withdrawals::get_withdraw_message(
        &env,
        &attacker_wallet.address,
        WITHDRAW_AMOUNT_SATS,
        expires_at_seconds,
    );
    let attacker_signature = wallets::sign_message(&attacker_wallet, &attacker_message);

    // when
    let impersonation_payload = AuthenticatedPayload {
        data: WithdrawCkbtcRequest {
            amount: WITHDRAW_AMOUNT_SATS,
            expires_at_seconds,
        },
        wallet_proof: WalletProof {
            address: victim_wallet.address.clone(),
            signature: attacker_signature,
        },
    };
    let result = call_withdraw(&env, impersonation_payload);

    // then
    let err = result.expect_err("impersonation must be rejected");
    assert_eq!(
        err.code,
        error_codes::INVALID_SIGNATURE.code,
        "expected INVALID_SIGNATURE, got {:?}",
        err
    );
}

// ======================================================================
// L. Nonce replay
// ======================================================================

/// Given: a valid signed withdrawal submitted once successfully
/// When: the exact same AuthenticatedPayload is submitted again
/// Then: the nonce has advanced, the canister rebuilds a different
///       canonical message, and the replayed signature fails.
#[test]
fn test_nonce_replay_same_payload_submitted_twice_is_rejected_on_second_call() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WALLET_SEED: u64 = 401;
    let wallet = generate_wallet(WALLET_SEED);
    let profile = create_account(&env, &wallet).expect("register");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("fund");

    let expires_at_seconds = expires_at(&env);
    let message = withdrawals::get_withdraw_message(
        &env,
        &wallet.address,
        WITHDRAW_AMOUNT_SATS,
        expires_at_seconds,
    );
    let signature = wallets::sign_message(&wallet, &message);
    let payload = AuthenticatedPayload {
        data: WithdrawCkbtcRequest {
            amount: WITHDRAW_AMOUNT_SATS,
            expires_at_seconds,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
        },
    };

    // when
    let first = call_withdraw(&env, payload.clone());
    let second = call_withdraw(&env, payload);

    // then
    assert!(
        first.is_ok(),
        "first submission must succeed, got {:?}",
        first
    );
    let err = second.expect_err("second submission must be rejected (nonce advanced)");
    assert_eq!(
        err.code,
        error_codes::INVALID_SIGNATURE.code,
        "expected INVALID_SIGNATURE, got {:?}",
        err
    );
}

// ======================================================================
// M. Expiry window abuse
// ======================================================================

/// Given: a payload carrying `expires_at_seconds` in the past
/// When: the canister validates `ensure_challenge_fresh`
/// Then: the call is rejected with `CHALLENGE_EXPIRED` before the
///       signature verifier ever runs.
#[test]
fn test_expiry_in_the_past_is_rejected_with_challenge_expired() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WALLET_SEED: u64 = 501;
    let wallet = generate_wallet(WALLET_SEED);
    let profile = create_account(&env, &wallet).expect("register");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("fund");

    let now_seconds = env.get_time_ns() / 1_000_000_000;
    const ONE_SECOND: u64 = 1;
    let already_expired = now_seconds.saturating_sub(ONE_SECOND);

    // Sign with the expired expiry so the canonical message itself encodes
    // it — this isolates the freshness check as the failing step.
    let message = withdrawals::get_withdraw_message(
        &env,
        &wallet.address,
        WITHDRAW_AMOUNT_SATS,
        already_expired,
    );
    let signature = wallets::sign_message(&wallet, &message);
    let payload = AuthenticatedPayload {
        data: WithdrawCkbtcRequest {
            amount: WITHDRAW_AMOUNT_SATS,
            expires_at_seconds: already_expired,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
        },
    };

    // when
    let result = call_withdraw(&env, payload);

    // then
    let err = result.expect_err("expired challenge must be rejected");
    assert_eq!(
        err.code,
        error_codes::CHALLENGE_EXPIRED.code,
        "expected CHALLENGE_EXPIRED, got {:?}",
        err
    );
}

/// Given: a payload with `expires_at_seconds` far beyond the permitted
///        window (>10 minutes into the future)
/// When: the canister validates freshness
/// Then: the call is rejected — prevents clients from minting long-lived
///       authorizations that could be replayed if nonce reuse ever occurred.
#[test]
fn test_expiry_too_far_in_future_is_rejected() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WALLET_SEED: u64 = 502;
    let wallet = generate_wallet(WALLET_SEED);
    let profile = create_account(&env, &wallet).expect("register");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("fund");

    const ONE_HOUR_SECONDS: u64 = 3_600;
    let now_seconds = env.get_time_ns() / 1_000_000_000;
    let too_far_future = now_seconds + ONE_HOUR_SECONDS;

    let message = withdrawals::get_withdraw_message(
        &env,
        &wallet.address,
        WITHDRAW_AMOUNT_SATS,
        too_far_future,
    );
    let signature = wallets::sign_message(&wallet, &message);
    let payload = AuthenticatedPayload {
        data: WithdrawCkbtcRequest {
            amount: WITHDRAW_AMOUNT_SATS,
            expires_at_seconds: too_far_future,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
        },
    };

    // when
    let result = call_withdraw(&env, payload);

    // then
    let err = result.expect_err("far-future expiry must be rejected");
    assert_eq!(
        err.code,
        error_codes::CHALLENGE_EXPIRED.code,
        "expected CHALLENGE_EXPIRED, got {:?}",
        err
    );
}

/// Given: a payload signed within the allowed window
/// When: time advances past `expires_at_seconds` before the canister
///       receives the update call
/// Then: the freshness check rejects the payload, even though the
///       signature itself is cryptographically valid.
#[test]
fn test_expiry_lapses_between_signing_and_submission_is_rejected() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WALLET_SEED: u64 = 503;
    let wallet = generate_wallet(WALLET_SEED);
    let profile = create_account(&env, &wallet).expect("register");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("fund");

    let expires_at_seconds = expires_at(&env);
    let message = withdrawals::get_withdraw_message(
        &env,
        &wallet.address,
        WITHDRAW_AMOUNT_SATS,
        expires_at_seconds,
    );
    let signature = wallets::sign_message(&wallet, &message);
    let payload = AuthenticatedPayload {
        data: WithdrawCkbtcRequest {
            amount: WITHDRAW_AMOUNT_SATS,
            expires_at_seconds,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
        },
    };

    // when
    const EXPIRY_BUFFER_SECONDS: u64 = 60;
    env.advance_time_secs(SIGNING_WINDOW_SECONDS + EXPIRY_BUFFER_SECONDS);
    let result = call_withdraw(&env, payload);

    // then
    let err = result.expect_err("lapsed challenge must be rejected");
    assert_eq!(
        err.code,
        error_codes::CHALLENGE_EXPIRED.code,
        "expected CHALLENGE_EXPIRED, got {:?}",
        err
    );
}

// ======================================================================
// N. Action-field tampering
// ======================================================================

/// Given: user signs a `cancel_offer` challenge for offer_id = X
/// When: attacker submits with offer_id = Y (different value) but the
///       same signature
/// Then: canister reconstructs the challenge with offer_id = Y,
///       signature fails, call rejected. Confirms every action-specific
///       field participates in the canonical binding.
#[test]
fn test_action_field_tampering_offer_id_swap_is_rejected() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WALLET_SEED: u64 = 601;
    let wallet = generate_wallet(WALLET_SEED);
    let profile = create_account(&env, &wallet).expect("register");
    mint_and_sync_balance(&env, &profile, OFFER_QUANTITY_SATS * 2).expect("fund");

    let create_response = offers::create_offer(
        &env,
        &wallet,
        OFFER_QUANTITY_SATS,
        OFFER_STRIKE_BPS,
        OFFER_PREMIUM_BPS,
        OFFER_DURATION_SECS,
    )
    .expect("create offer");
    let real_offer_id = create_response.offer.id;

    let expires_at_seconds = expires_at(&env);
    let cancel_message =
        offers::get_cancel_offer_message(&env, &wallet.address, real_offer_id, expires_at_seconds);
    let signature = wallets::sign_message(&wallet, &cancel_message);

    // when
    let tampered_offer_id = real_offer_id + 1;
    let payload = AuthenticatedPayload {
        data: CancelOfferRequest {
            offer_id: tampered_offer_id,
            expires_at_seconds,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
        },
    };
    let result = call_cancel_offer(&env, payload);

    // then
    let err = result.expect_err("tampered offer_id must be rejected");
    assert_eq!(
        err.code,
        error_codes::INVALID_SIGNATURE.code,
        "expected INVALID_SIGNATURE, got {:?}",
        err
    );
}

/// Given: user signs a `withdraw_ckbtc` challenge for amount = X sats
/// When: attacker submits with amount = 10 * X but the same signature
/// Then: canister rebuilds with the tampered amount, signature fails,
///       call rejected. Regression against partial-tampering of typed
///       action fields.
#[test]
fn test_action_field_tampering_withdraw_amount_swap_is_rejected() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WALLET_SEED: u64 = 602;
    let wallet = generate_wallet(WALLET_SEED);
    let profile = create_account(&env, &wallet).expect("register");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("fund");

    let expires_at_seconds = expires_at(&env);
    const AMOUNT_UPLIFT_FACTOR: u64 = 10;
    let message = withdrawals::get_withdraw_message(
        &env,
        &wallet.address,
        WITHDRAW_AMOUNT_SATS,
        expires_at_seconds,
    );
    let signature = wallets::sign_message(&wallet, &message);

    // when
    let payload = AuthenticatedPayload {
        data: WithdrawCkbtcRequest {
            amount: WITHDRAW_AMOUNT_SATS * AMOUNT_UPLIFT_FACTOR,
            expires_at_seconds,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
        },
    };
    let result = call_withdraw(&env, payload);

    // then
    let err = result.expect_err("tampered amount must be rejected");
    assert_eq!(
        err.code,
        error_codes::INVALID_SIGNATURE.code,
        "expected INVALID_SIGNATURE, got {:?}",
        err
    );
}

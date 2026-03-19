use candid::Decode;

use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    configure_test_ledger, create_account, create_offer, mint_and_sync_balance, set_oracle_price,
    settle_option_by_id, testing_set_option_expiry, whitelist_controller, withdraw_ckbtc,
};
use volumetric::auth::types::WalletProof;
use volumetric::{
    AcceptOfferItem, AcceptOffersReceipt, AcceptOffersRequest, AuthenticatedPayload,
    VolumetricError,
};

const ORACLE_PRICE_CENTS: u64 = 10_000_000;
const TEN_MILLION_SATS: u64 = 10_000_000;
const STRIKE_BPS: u16 = 500;
const PREMIUM_BPS: u16 = 100;
const ONE_DAY_SECS: u64 = 86_400;
const CKBTC_TRANSFER_FEE_SATS: u64 = 10;
const BASIS_POINTS: u64 = 10_000;
const OFFER_ID: u64 = 1;
const TEST_BTC_ADDRESS: &str = "tb1qstatusguard";
const WITHDRAW_AMOUNT_SATS: u64 = 100_000;

fn assert_replicated_query_guard_rejects<T, E: std::fmt::Debug>(result: Result<T, E>) {
    assert!(result.is_err(), "replicated query call should be rejected");
    let err_debug = format!("{:?}", result.err().expect("error should exist"));
    assert!(
        err_debug.contains("Not allowed"),
        "expected guard rejection, got: {}",
        err_debug
    );
}

fn accept_offers_receipt(
    env: &crate::common::TestEnv,
    buyer_wallet: &crate::common::TestWallet,
    items: Vec<AcceptOfferItem>,
) -> Result<AcceptOffersReceipt, VolumetricError> {
    let message = crate::helpers::offers::get_accept_offers_message(
        env,
        &buyer_wallet.address,
        items.clone(),
    );
    let signature = crate::common::wallets::sign_message(buyer_wallet, &message);

    let payload = AuthenticatedPayload {
        data: AcceptOffersRequest { items },
        wallet_proof: WalletProof {
            address: buyer_wallet.address.clone(),
            signature,
        },
    };

    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "accept_offers",
            candid::encode_one(payload).unwrap(),
        )
        .expect("accept_offers update call failed");

    Decode!(&response, Result<AcceptOffersReceipt, VolumetricError>).unwrap()
}

/// Given: an accepted offer has an operation id
/// When: get_accept_status is called through update_call (replicated execution)
/// Then: no_replicated_call rejects it
#[test]
fn test_get_accept_status_rejects_replicated_calls() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);
    set_oracle_price(&env, ORACLE_PRICE_CENTS);

    let writer_wallet = generate_wallet(31);
    let buyer_wallet = generate_wallet(32);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

    let premium_sats = TEN_MILLION_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    let buyer_required_sats = premium_sats + (CKBTC_TRANSFER_FEE_SATS * 2);
    mint_and_sync_balance(&env, &writer_profile, TEN_MILLION_SATS).expect("Writer funding failed");
    mint_and_sync_balance(&env, &buyer_profile, buyer_required_sats).expect("Buyer funding failed");

    create_offer(
        &env,
        &writer_wallet,
        TEN_MILLION_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    let receipt = accept_offers_receipt(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: OFFER_ID,
            quantity: TEN_MILLION_SATS,
        }],
    )
    .expect("accept should enqueue");

    // when
    let replicated_query_call = env.pic.update_call(
        env.volumetric_canister,
        env.controller,
        "get_accept_status",
        candid::encode_one(receipt.operation_id).unwrap(),
    );

    // then
    assert_replicated_query_guard_rejects(replicated_query_call);
}

/// Given: a settlement has been enqueued and has an operation id
/// When: get_settlement_status is called via update_call (replicated execution)
/// Then: no_replicated_call rejects it
#[test]
fn test_get_settlement_status_rejects_replicated_calls() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);
    set_oracle_price(&env, ORACLE_PRICE_CENTS);

    let writer_wallet = generate_wallet(33);
    let buyer_wallet = generate_wallet(34);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

    let premium_sats = TEN_MILLION_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    let buyer_required_sats = premium_sats + (CKBTC_TRANSFER_FEE_SATS * 2);
    mint_and_sync_balance(&env, &writer_profile, TEN_MILLION_SATS).expect("Writer funding failed");
    mint_and_sync_balance(&env, &buyer_profile, buyer_required_sats).expect("Buyer funding failed");

    create_offer(
        &env,
        &writer_wallet,
        TEN_MILLION_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    crate::helpers::accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: OFFER_ID,
            quantity: TEN_MILLION_SATS,
        }],
    )
    .expect("accept should succeed");

    testing_set_option_expiry(&env, OFFER_ID, 0).expect("set option expiry failed");
    let settle_receipt = settle_option_by_id(&env, OFFER_ID).expect("settle should enqueue");

    // when
    let replicated_query_call = env.pic.update_call(
        env.volumetric_canister,
        env.controller,
        "get_settlement_status",
        candid::encode_one(settle_receipt.operation_id).unwrap(),
    );

    // then
    assert_replicated_query_guard_rejects(replicated_query_call);
}

/// Given: a withdraw request has an operation id
/// When: get_withdraw_status is called through update_call (replicated execution)
/// Then: no_replicated_call rejects it
#[test]
fn test_get_withdraw_status_rejects_replicated_calls() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    let wallet = generate_wallet(35);
    let profile = create_account(&env, &wallet).expect("Create account failed");
    mint_and_sync_balance(&env, &profile, 500_000).expect("Funding failed");

    let withdraw_receipt = withdraw_ckbtc(&env, &wallet, TEST_BTC_ADDRESS, WITHDRAW_AMOUNT_SATS)
        .expect("withdraw should enqueue");

    // when
    let replicated_query_call = env.pic.update_call(
        env.volumetric_canister,
        env.controller,
        "get_withdraw_status",
        candid::encode_one(withdraw_receipt.operation_id).unwrap(),
    );

    // then
    assert_replicated_query_guard_rejects(replicated_query_call);
}

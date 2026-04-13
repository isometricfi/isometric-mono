use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    accept_offers, configure_test_ledger, create_account, create_offer, mint_and_sync_balance,
    set_oracle_price, whitelist_controller, withdraw_ckbtc,
};
use volumetric::errors::error_codes;
use volumetric::AcceptOfferItem;

const ORACLE_PRICE_CENTS: u64 = 10_000_000;

/// Given: buyer has initiated a withdrawal that debits available balance
/// When: the same buyer tries to accept an offer using those funds
/// Then: accept is rejected with insufficient balance
#[test]
fn test_buyer_cannot_accept_offer_after_withdraw_debits_same_funds() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);
    set_oracle_price(&env, ORACLE_PRICE_CENTS);

    const WRITER_SEED: u64 = 71;
    const BUYER_SEED: u64 = 72;
    const OFFER_ID: u64 = 1;
    const OFFER_QUANTITY_SATS: u64 = 1_000_000;
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const BUYER_INITIAL_BALANCE_SATS: u64 = 100_000;
    const WITHDRAW_LEDGER_FEE_CHARGE_COUNT: u64 = 2;
    const CKBTC_TRANSFER_FEE_SATS: u64 = 10;
    const WITHDRAW_LEDGER_FEE_RESERVE_SATS: u64 =
        CKBTC_TRANSFER_FEE_SATS * WITHDRAW_LEDGER_FEE_CHARGE_COUNT;
    const WITHDRAW_AMOUNT_SATS: u64 = BUYER_INITIAL_BALANCE_SATS - WITHDRAW_LEDGER_FEE_RESERVE_SATS;

    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("buyer account failed");

    mint_and_sync_balance(&env, &writer_profile, OFFER_QUANTITY_SATS)
        .expect("writer funding failed");
    mint_and_sync_balance(&env, &buyer_profile, BUYER_INITIAL_BALANCE_SATS)
        .expect("buyer funding failed");

    create_offer(
        &env,
        &writer_wallet,
        OFFER_QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("create offer failed");

    let _withdraw_receipt = withdraw_ckbtc(
        &env,
        &buyer_wallet,
        "tb1qe2econtention",
        WITHDRAW_AMOUNT_SATS,
    )
    .expect("withdraw should enqueue");

    // when
    let accept_result = accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: OFFER_ID,
            quantity: OFFER_QUANTITY_SATS,
        }],
    );

    // then
    let accept_error =
        accept_result.expect_err("accept should fail after withdraw debits buyer balance");
    assert_eq!(accept_error.code, error_codes::INSUFFICIENT_BALANCE.code);
}

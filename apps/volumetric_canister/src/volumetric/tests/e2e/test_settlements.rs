use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    accept_offers, configure_test_ledger, create_account, create_offer,
    get_fee_recipient_ledger_balance, get_pending_settlements, get_user_balance,
    mint_and_sync_balance, set_oracle_price, whitelist_controller,
};
use volumetric::AcceptOfferItem;

const ONE_BTC_SATS: u64 = 100_000_000;
const BASIS_POINTS: u64 = 10_000;
const PREMIUM_BPS: u16 = 100;
const PREMIUM_FEE_BPS: u64 = 500;
const PROFIT_FEE_BPS: u64 = 2000;
const ENTRY_PRICE_CENTS: u64 = 10_000_000;
const ONE_DAY_SECS: u64 = 86_400;
const ONE_HOUR_SECS: u64 = 3_600;
const CKBTC_TRANSFER_FEE: u64 = 10;
const FIRST_OFFER_ID: u64 = 1;

const QUANTITY_SATS: u64 = ONE_BTC_SATS;
const PREMIUM_SATS: u64 = QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
const ACCEPT_TRANSFER_COUNT: u64 = 2;
const ACCEPT_TRANSFER_FEES: u64 = ACCEPT_TRANSFER_COUNT * CKBTC_TRANSFER_FEE;

/// Given: 1 BTC call option, entry $100k, strike $105k (+5%), premium 1% (0.01 BTC)
/// When: Price rises to $210k (2x strike), option expires
/// Then: Buyer nets 0.4 BTC, writer gets 0.6 BTC, platform collects 0.1 BTC profit fee
#[test]
fn test_expired_itm_option_auto_settles_with_correct_payouts() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 1;
    const BUYER_SEED: u64 = 2;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);

    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

    const STRIKE_BPS: u16 = 500;
    const STRIKE_PRICE_CENTS: u64 =
        ENTRY_PRICE_CENTS + ENTRY_PRICE_CENTS * STRIKE_BPS as u64 / BASIS_POINTS;
    const SETTLEMENT_PRICE_CENTS: u64 = STRIKE_PRICE_CENTS * 2;

    let fee_recipient_balance_before = get_fee_recipient_ledger_balance(&env);

    mint_and_sync_balance(&env, &writer_profile, QUANTITY_SATS).expect("Writer balance failed");
    mint_and_sync_balance(&env, &buyer_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer balance failed");

    set_oracle_price(&env, ENTRY_PRICE_CENTS);

    create_offer(
        &env,
        &writer_wallet,
        QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    )
    .expect("Accept offer failed");

    const EXPECTED_PREMIUM_FEE_SATS: u64 = PREMIUM_SATS * PREMIUM_FEE_BPS / BASIS_POINTS;
    let fee_recipient_balance_after_accept = get_fee_recipient_ledger_balance(&env);
    let premium_fee_received = fee_recipient_balance_after_accept - fee_recipient_balance_before;
    assert_eq!(premium_fee_received, EXPECTED_PREMIUM_FEE_SATS);

    let writer_balance_before =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_before =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");

    assert_eq!(writer_balance_before.locked, QUANTITY_SATS);

    set_oracle_price(&env, SETTLEMENT_PRICE_CENTS);

    // when
    env.advance_time_secs(ONE_DAY_SECS + ONE_HOUR_SECS);

    // then
    const EXPECTED_GROSS_BUYER_PAYOUT_SATS: u64 = 50_000_000;

    const EXPECTED_PROFIT_FEE_SATS: u64 =
        EXPECTED_GROSS_BUYER_PAYOUT_SATS * PROFIT_FEE_BPS / BASIS_POINTS;

    const EXPECTED_BUYER_PAYOUT_SATS: u64 =
        EXPECTED_GROSS_BUYER_PAYOUT_SATS - EXPECTED_PROFIT_FEE_SATS;

    const EXPECTED_WRITER_BALANCE_INCREASE_SATS: u64 =
        QUANTITY_SATS - EXPECTED_GROSS_BUYER_PAYOUT_SATS + EXPECTED_PROFIT_FEE_SATS;

    const EXPECTED_TOTAL_PLATFORM_FEES_SATS: u64 =
        EXPECTED_PREMIUM_FEE_SATS + EXPECTED_PROFIT_FEE_SATS;

    let pending_settlements = get_pending_settlements(&env);
    assert_eq!(pending_settlements.len(), 0);

    let writer_balance_after =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_after =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");

    assert_eq!(writer_balance_after.locked, 0);

    let writer_received = writer_balance_after.available - writer_balance_before.available;
    let buyer_received = buyer_balance_after.available - buyer_balance_before.available;

    assert_eq!(buyer_received, EXPECTED_BUYER_PAYOUT_SATS);
    assert_eq!(writer_received, EXPECTED_WRITER_BALANCE_INCREASE_SATS);

    let fee_recipient_balance_after_settle = get_fee_recipient_ledger_balance(&env);
    let profit_fee_received =
        fee_recipient_balance_after_settle - fee_recipient_balance_after_accept;
    assert_eq!(profit_fee_received, EXPECTED_PROFIT_FEE_SATS);

    let total_platform_fees = fee_recipient_balance_after_settle - fee_recipient_balance_before;
    assert_eq!(total_platform_fees, EXPECTED_TOTAL_PLATFORM_FEES_SATS);
}

/// Given: 1 BTC call option, entry $100k, strike $105k (+5%), premium 1% (0.01 BTC)
/// When: Price only rises to $102k (below strike), option expires OTM
/// Then: Writer keeps all 1 BTC collateral, buyer gets nothing, platform only collects premium fee
#[test]
fn test_expired_otm_option_writer_wins_keeps_all_collateral() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 1;
    const BUYER_SEED: u64 = 2;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);

    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

    const STRIKE_BPS: u16 = 500;
    const SETTLEMENT_PRICE_CENTS: u64 = 10_200_000;

    let fee_recipient_balance_before = get_fee_recipient_ledger_balance(&env);

    mint_and_sync_balance(&env, &writer_profile, QUANTITY_SATS).expect("Writer balance failed");
    mint_and_sync_balance(&env, &buyer_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer balance failed");

    set_oracle_price(&env, ENTRY_PRICE_CENTS);

    create_offer(
        &env,
        &writer_wallet,
        QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    )
    .expect("Accept offer failed");

    const EXPECTED_PREMIUM_FEE_SATS: u64 = PREMIUM_SATS * PREMIUM_FEE_BPS / BASIS_POINTS;
    let fee_recipient_balance_after_accept = get_fee_recipient_ledger_balance(&env);
    let premium_fee_received = fee_recipient_balance_after_accept - fee_recipient_balance_before;
    assert_eq!(premium_fee_received, EXPECTED_PREMIUM_FEE_SATS);

    let writer_balance_before =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_before =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");

    assert_eq!(writer_balance_before.locked, QUANTITY_SATS);

    set_oracle_price(&env, SETTLEMENT_PRICE_CENTS);

    // when
    env.advance_time_secs(ONE_DAY_SECS + ONE_HOUR_SECS);

    // then
    const EXPECTED_WRITER_PAYOUT_SATS: u64 = QUANTITY_SATS;
    const EXPECTED_BUYER_PAYOUT_SATS: u64 = 0;

    let pending_settlements = get_pending_settlements(&env);
    assert_eq!(pending_settlements.len(), 0);

    let writer_balance_after =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_after =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");

    assert_eq!(writer_balance_after.locked, 0);

    let writer_received = writer_balance_after.available - writer_balance_before.available;
    let buyer_received = buyer_balance_after.available - buyer_balance_before.available;

    assert_eq!(writer_received, EXPECTED_WRITER_PAYOUT_SATS);
    assert_eq!(buyer_received, EXPECTED_BUYER_PAYOUT_SATS);

    let fee_recipient_balance_after_settle = get_fee_recipient_ledger_balance(&env);
    let profit_fee_received =
        fee_recipient_balance_after_settle - fee_recipient_balance_after_accept;
    assert_eq!(profit_fee_received, 0);

    let total_platform_fees = fee_recipient_balance_after_settle - fee_recipient_balance_before;
    assert_eq!(total_platform_fees, EXPECTED_PREMIUM_FEE_SATS);
}

/// Given: Two 1 BTC call options from different parties, same entry/strike/premium
/// When: Price rises to $106k, both options expire (one ITM at +5% strike, one OTM at +10% strike)
/// Then: Both settle in single cron tick with correct payouts for each
#[test]
fn test_multiple_options_settle_in_single_cron_tick() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_1_SEED: u64 = 1;
    const BUYER_1_SEED: u64 = 2;
    const WRITER_2_SEED: u64 = 3;
    const BUYER_2_SEED: u64 = 4;

    let writer_1_wallet = generate_wallet(WRITER_1_SEED);
    let buyer_1_wallet = generate_wallet(BUYER_1_SEED);
    let writer_2_wallet = generate_wallet(WRITER_2_SEED);
    let buyer_2_wallet = generate_wallet(BUYER_2_SEED);

    let writer_1_profile = create_account(&env, &writer_1_wallet).expect("Writer 1 account failed");
    let buyer_1_profile = create_account(&env, &buyer_1_wallet).expect("Buyer 1 account failed");
    let writer_2_profile = create_account(&env, &writer_2_wallet).expect("Writer 2 account failed");
    let buyer_2_profile = create_account(&env, &buyer_2_wallet).expect("Buyer 2 account failed");

    const STRIKE_BPS_ITM: u16 = 500;
    const STRIKE_BPS_OTM: u16 = 1000;
    const SETTLEMENT_PRICE_CENTS: u64 = 10_600_000;
    const SECOND_OFFER_ID: u64 = 2;

    let fee_recipient_balance_before = get_fee_recipient_ledger_balance(&env);

    mint_and_sync_balance(&env, &writer_1_profile, QUANTITY_SATS).expect("Writer 1 balance failed");
    mint_and_sync_balance(&env, &buyer_1_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer 1 balance failed");
    mint_and_sync_balance(&env, &writer_2_profile, QUANTITY_SATS).expect("Writer 2 balance failed");
    mint_and_sync_balance(&env, &buyer_2_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer 2 balance failed");

    set_oracle_price(&env, ENTRY_PRICE_CENTS);

    create_offer(
        &env,
        &writer_1_wallet,
        QUANTITY_SATS,
        STRIKE_BPS_ITM,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer 1 failed");

    create_offer(
        &env,
        &writer_2_wallet,
        QUANTITY_SATS,
        STRIKE_BPS_OTM,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer 2 failed");

    accept_offers(
        &env,
        &buyer_1_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    )
    .expect("Accept offer 1 failed");

    accept_offers(
        &env,
        &buyer_2_wallet,
        vec![AcceptOfferItem {
            offer_id: SECOND_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    )
    .expect("Accept offer 2 failed");

    const EXPECTED_PREMIUM_FEE_PER_OPTION_SATS: u64 = PREMIUM_SATS * PREMIUM_FEE_BPS / BASIS_POINTS;
    const EXPECTED_TOTAL_PREMIUM_FEES_SATS: u64 = EXPECTED_PREMIUM_FEE_PER_OPTION_SATS * 2;

    let fee_recipient_balance_after_accept = get_fee_recipient_ledger_balance(&env);
    let premium_fees_received = fee_recipient_balance_after_accept - fee_recipient_balance_before;
    assert_eq!(premium_fees_received, EXPECTED_TOTAL_PREMIUM_FEES_SATS);

    let writer_1_balance_before =
        get_user_balance(&env, &writer_1_wallet.address).expect("Writer 1 balance failed");
    let buyer_1_balance_before =
        get_user_balance(&env, &buyer_1_wallet.address).expect("Buyer 1 balance failed");
    let writer_2_balance_before =
        get_user_balance(&env, &writer_2_wallet.address).expect("Writer 2 balance failed");
    let buyer_2_balance_before =
        get_user_balance(&env, &buyer_2_wallet.address).expect("Buyer 2 balance failed");

    assert_eq!(writer_1_balance_before.locked, QUANTITY_SATS);
    assert_eq!(writer_2_balance_before.locked, QUANTITY_SATS);

    set_oracle_price(&env, SETTLEMENT_PRICE_CENTS);

    // when
    env.advance_time_secs(ONE_DAY_SECS + ONE_HOUR_SECS);

    // then
    const EXPECTED_GROSS_BUYER_1_PAYOUT_SATS: u64 = 943_396;
    const EXPECTED_PROFIT_FEE_SATS: u64 =
        EXPECTED_GROSS_BUYER_1_PAYOUT_SATS * PROFIT_FEE_BPS / BASIS_POINTS;
    const EXPECTED_BUYER_1_PAYOUT_SATS: u64 =
        EXPECTED_GROSS_BUYER_1_PAYOUT_SATS - EXPECTED_PROFIT_FEE_SATS;
    const EXPECTED_WRITER_1_PAYOUT_SATS: u64 =
        QUANTITY_SATS - EXPECTED_GROSS_BUYER_1_PAYOUT_SATS + EXPECTED_PROFIT_FEE_SATS;

    const EXPECTED_WRITER_2_PAYOUT_SATS: u64 = QUANTITY_SATS;
    const EXPECTED_BUYER_2_PAYOUT_SATS: u64 = 0;

    let pending_settlements = get_pending_settlements(&env);
    assert_eq!(pending_settlements.len(), 0);

    let writer_1_balance_after =
        get_user_balance(&env, &writer_1_wallet.address).expect("Writer 1 balance failed");
    let buyer_1_balance_after =
        get_user_balance(&env, &buyer_1_wallet.address).expect("Buyer 1 balance failed");
    let writer_2_balance_after =
        get_user_balance(&env, &writer_2_wallet.address).expect("Writer 2 balance failed");
    let buyer_2_balance_after =
        get_user_balance(&env, &buyer_2_wallet.address).expect("Buyer 2 balance failed");

    assert_eq!(writer_1_balance_after.locked, 0);
    assert_eq!(writer_2_balance_after.locked, 0);

    let writer_1_received = writer_1_balance_after.available - writer_1_balance_before.available;
    let buyer_1_received = buyer_1_balance_after.available - buyer_1_balance_before.available;
    let writer_2_received = writer_2_balance_after.available - writer_2_balance_before.available;
    let buyer_2_received = buyer_2_balance_after.available - buyer_2_balance_before.available;

    assert_eq!(writer_1_received, EXPECTED_WRITER_1_PAYOUT_SATS);
    assert_eq!(buyer_1_received, EXPECTED_BUYER_1_PAYOUT_SATS);
    assert_eq!(writer_2_received, EXPECTED_WRITER_2_PAYOUT_SATS);
    assert_eq!(buyer_2_received, EXPECTED_BUYER_2_PAYOUT_SATS);

    let fee_recipient_balance_after_settle = get_fee_recipient_ledger_balance(&env);
    let profit_fee_received =
        fee_recipient_balance_after_settle - fee_recipient_balance_after_accept;
    assert_eq!(profit_fee_received, EXPECTED_PROFIT_FEE_SATS);

    let total_platform_fees = fee_recipient_balance_after_settle - fee_recipient_balance_before;
    assert_eq!(
        total_platform_fees,
        EXPECTED_TOTAL_PREMIUM_FEES_SATS + EXPECTED_PROFIT_FEE_SATS
    );
}

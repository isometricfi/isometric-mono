use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    accept_offers, configure_test_ledger, create_account, create_offer, get_open_offers,
    get_user_balance, mint_and_sync_balance, set_feature_flags, whitelist_controller,
};
use volumetric::{AcceptOfferItem, ActiveOptionStatus, FeatureFlags, OfferStatus};

/// Given: Writer creates 10M sats offer, buyer has premium + fees
/// When: Buyer accepts full offer quantity
/// Then: Option created, writer collateral locked, offer removed from open offers
#[test]
fn test_buyer_accepts_offer_creates_option_and_locks_writer_collateral() {
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

    const TEN_MILLION_SATS: u64 = 10_000_000;
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const BASIS_POINTS: u64 = 10_000;
    const CKBTC_TRANSFER_FEE: u64 = 10;
    const FIRST_OFFER_ID: u64 = 1;

    const QUANTITY_SATS: u64 = TEN_MILLION_SATS;
    const PREMIUM_SATS: u64 = QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const ACCEPT_TRANSFER_COUNT: u64 = 2;
    const ACCEPT_TRANSFER_FEES: u64 = ACCEPT_TRANSFER_COUNT * CKBTC_TRANSFER_FEE;

    mint_and_sync_balance(&env, &writer_profile, QUANTITY_SATS).expect("Writer balance failed");
    mint_and_sync_balance(&env, &buyer_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer balance failed");

    create_offer(
        &env,
        &writer_wallet,
        QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    // when
    let accept_response = accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    )
    .expect("Accept offer failed");

    // then
    const EXPECTED_OPTIONS_COUNT: usize = 1;
    const EXPECTED_OPEN_OFFERS_AFTER: usize = 0;

    assert_eq!(accept_response.active_options.len(), EXPECTED_OPTIONS_COUNT);

    let option = &accept_response.active_options[0];
    assert_eq!(option.quantity, QUANTITY_SATS);
    assert_eq!(option.writer, writer_profile.principal);
    assert_eq!(option.buyer, buyer_profile.principal);
    assert_eq!(option.status, ActiveOptionStatus::Active);

    let writer_balance =
        get_user_balance(&env, &writer_wallet.address).expect("Failed to get writer balance");
    assert_eq!(writer_balance.locked, QUANTITY_SATS);

    let offers = get_open_offers(&env);
    assert_eq!(offers.len(), EXPECTED_OPEN_OFFERS_AFTER);
}

/// Given: Writer creates 20M sats offer, buyer has premium for 10M sats
/// When: Buyer partially fills offer with 10M sats
/// Then: Option created for filled amount, offer remains open with 10M sats remaining
#[test]
fn test_partial_fill_creates_option_and_leaves_offer_open_for_remainder() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);
    set_feature_flags(
        &env,
        FeatureFlags {
            is_partial_filling_enabled: true,
            is_stitching_enabled: false,
        },
    );

    const WRITER_SEED: u64 = 1;
    const BUYER_SEED: u64 = 2;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);

    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

    const TEN_MILLION_SATS: u64 = 10_000_000;
    const TWENTY_MILLION_SATS: u64 = 20_000_000;
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const BASIS_POINTS: u64 = 10_000;
    const CKBTC_TRANSFER_FEE: u64 = 10;
    const FIRST_OFFER_ID: u64 = 1;

    const TOTAL_QUANTITY_SATS: u64 = TWENTY_MILLION_SATS;
    const FILL_QUANTITY_SATS: u64 = TEN_MILLION_SATS;
    const PREMIUM_FOR_FILL_SATS: u64 = FILL_QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const ACCEPT_TRANSFER_COUNT: u64 = 2;
    const ACCEPT_TRANSFER_FEES: u64 = ACCEPT_TRANSFER_COUNT * CKBTC_TRANSFER_FEE;

    mint_and_sync_balance(&env, &writer_profile, TOTAL_QUANTITY_SATS)
        .expect("Writer balance failed");
    mint_and_sync_balance(
        &env,
        &buyer_profile,
        PREMIUM_FOR_FILL_SATS + ACCEPT_TRANSFER_FEES,
    )
    .expect("Buyer balance failed");

    create_offer(
        &env,
        &writer_wallet,
        TOTAL_QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    // when
    let accept_response = accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: FILL_QUANTITY_SATS,
        }],
    )
    .expect("Accept offer failed");

    // then
    const EXPECTED_OPTIONS_COUNT: usize = 1;
    const EXPECTED_OPEN_OFFERS_AFTER: usize = 1;
    const EXPECTED_REMAINING_SATS: u64 = TOTAL_QUANTITY_SATS - FILL_QUANTITY_SATS;

    assert_eq!(accept_response.active_options.len(), EXPECTED_OPTIONS_COUNT);
    assert_eq!(
        accept_response.active_options[0].quantity,
        FILL_QUANTITY_SATS
    );

    let offers = get_open_offers(&env);
    assert_eq!(offers.len(), EXPECTED_OPEN_OFFERS_AFTER);
    assert_eq!(offers[0].remaining_quantity, EXPECTED_REMAINING_SATS);
    assert_eq!(offers[0].status, OfferStatus::PartiallyFilled);
}

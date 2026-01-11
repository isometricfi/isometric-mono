use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    accept_offers, cancel_offer, configure_test_ledger, create_account, create_offer,
    get_events_for_principal, get_open_offers, get_user_balance, mint_and_sync_balance,
    set_feature_flags, whitelist_controller,
};
use volumetric::errors::error_codes;
use volumetric::{
    AcceptOfferItem, ActiveOptionStatus, EventData, EventType, FeatureFlags, OfferStatus, TradeRole,
};

/// Given: Writer creates 0.1 BTC offer, buyer has premium + fees
/// When: Buyer accepts full offer quantity
/// Then: Option created, writer collateral locked, offer removed, OfferAccepted events emitted
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

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
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
    const EXPECTED_OPTION_ID: u64 = 1;

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

    let active_option = &accept_response.active_options[0];

    let buyer_events = get_events_for_principal(&env, buyer_profile.principal);
    let buyer_accept_events: Vec<_> = buyer_events
        .iter()
        .filter(|e| e.event_type == EventType::OfferAccepted)
        .collect();
    assert_eq!(buyer_accept_events.len(), 1);
    assert_eq!(
        buyer_accept_events[0].data,
        EventData::OfferAccepted {
            offer_id: FIRST_OFFER_ID,
            option_id: EXPECTED_OPTION_ID,
            fill_group_id: accept_response.fill_group_id,
            counterparty: writer_profile.principal,
            quantity_sats: QUANTITY_SATS,
            premium_sats: PREMIUM_SATS,
            entry_price_cents: active_option.entry_price_cents,
            strike_price_cents: active_option.strike_price_cents,
            expiry_ns: active_option.expiry,
            role: TradeRole::Buyer,
        }
    );

    let writer_events = get_events_for_principal(&env, writer_profile.principal);
    let writer_accept_events: Vec<_> = writer_events
        .iter()
        .filter(|e| e.event_type == EventType::OfferAccepted)
        .collect();
    assert_eq!(writer_accept_events.len(), 1);
    assert_eq!(
        writer_accept_events[0].data,
        EventData::OfferAccepted {
            offer_id: FIRST_OFFER_ID,
            option_id: EXPECTED_OPTION_ID,
            fill_group_id: accept_response.fill_group_id,
            counterparty: buyer_profile.principal,
            quantity_sats: QUANTITY_SATS,
            premium_sats: PREMIUM_SATS,
            entry_price_cents: active_option.entry_price_cents,
            strike_price_cents: active_option.strike_price_cents,
            expiry_ns: active_option.expiry,
            role: TradeRole::Writer,
        }
    );
}

/// Given: Writer creates 0.2 BTC offer, buyer has premium for 0.1 BTC
/// When: Buyer partially fills offer with 0.1 BTC
/// Then: Option created for filled amount, offer remains open with 0.1 BTC remaining
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

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const TWENTY_MILLION_SATS: u64 = 20_000_000; // 0.2 BTC
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

/// Given: Writer creates 0.1 BTC offer, two buyers each have premium + fees for full quantity
/// When: Both buyers attempt to accept the full offer quantity
/// Then: First buyer succeeds, second buyer fails with offer not found (already filled)
#[test]
fn test_second_buyer_fails_when_offer_already_fully_accepted() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 1;
    const BUYER_1_SEED: u64 = 2;
    const BUYER_2_SEED: u64 = 3;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_1_wallet = generate_wallet(BUYER_1_SEED);
    let buyer_2_wallet = generate_wallet(BUYER_2_SEED);

    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_1_profile = create_account(&env, &buyer_1_wallet).expect("Buyer 1 account failed");
    let buyer_2_profile = create_account(&env, &buyer_2_wallet).expect("Buyer 2 account failed");

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
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
    mint_and_sync_balance(&env, &buyer_1_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer 1 balance failed");
    mint_and_sync_balance(&env, &buyer_2_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer 2 balance failed");

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
    let buyer_1_result = accept_offers(
        &env,
        &buyer_1_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    );

    let buyer_2_result = accept_offers(
        &env,
        &buyer_2_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    );

    // then
    assert!(buyer_1_result.is_ok());
    assert!(buyer_2_result.is_err());

    let buyer_1_response = buyer_1_result.unwrap();
    assert_eq!(buyer_1_response.active_options.len(), 1);
    assert_eq!(buyer_1_response.active_options[0].quantity, QUANTITY_SATS);

    let offers = get_open_offers(&env);
    assert_eq!(offers.len(), 0);
}

/// Given: Writer creates an offer
/// When: Writer attempts to accept their own offer
/// Then: Error CANNOT_ACCEPT_OWN_OFFER returned
#[test]
fn test_accept_own_offer_fails() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 1;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
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

    mint_and_sync_balance(
        &env,
        &writer_profile,
        QUANTITY_SATS + PREMIUM_SATS + ACCEPT_TRANSFER_FEES,
    )
    .expect("Writer balance failed");

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
    let result = accept_offers(
        &env,
        &writer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    );

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::CANNOT_ACCEPT_OWN_OFFER.code);
}

/// Given: Writer creates offer, time advances past offer_valid_until
/// When: Buyer attempts to accept
/// Then: Error OFFER_EXPIRED returned
#[test]
fn test_accept_expired_offer_fails() {
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

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const TWO_HOURS_SECS: u64 = 7_200;
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

    env.advance_time_secs(TWO_HOURS_SECS);

    // when
    let result = accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    );

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::OFFER_EXPIRED.code);
}

/// Given: Writer creates and cancels offer
/// When: Buyer attempts to accept
/// Then: Error OFFER_CANCELLED returned
#[test]
fn test_accept_cancelled_offer_fails() {
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

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
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

    cancel_offer(&env, &writer_wallet, FIRST_OFFER_ID).expect("Cancel offer failed");

    // when
    let result = accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    );

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::OFFER_CANCELLED.code);
}

/// Given: Writer creates offer, buyer has insufficient premium
/// When: Buyer attempts to accept
/// Then: Error INSUFFICIENT_BALANCE returned
#[test]
fn test_accept_with_insufficient_balance_fails() {
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

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const BASIS_POINTS: u64 = 10_000;
    const FIRST_OFFER_ID: u64 = 1;

    const QUANTITY_SATS: u64 = TEN_MILLION_SATS;
    const PREMIUM_SATS: u64 = QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const INSUFFICIENT_BALANCE: u64 = PREMIUM_SATS / 2;

    mint_and_sync_balance(&env, &writer_profile, QUANTITY_SATS).expect("Writer balance failed");
    mint_and_sync_balance(&env, &buyer_profile, INSUFFICIENT_BALANCE)
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
    let result = accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    );

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::INSUFFICIENT_BALANCE.code);
}

/// Given: Writer creates 0.1 BTC offer, partial filling disabled
/// When: Buyer attempts to accept 0.2 BTC
/// Then: Error QUANTITY_EXCEEDS_AVAILABLE returned
#[test]
fn test_accept_quantity_exceeds_remaining_fails() {
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

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const TWENTY_MILLION_SATS: u64 = 20_000_000; // 0.2 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const BASIS_POINTS: u64 = 10_000;
    const CKBTC_TRANSFER_FEE: u64 = 10;
    const FIRST_OFFER_ID: u64 = 1;

    const OFFER_QUANTITY_SATS: u64 = TEN_MILLION_SATS;
    const ACCEPT_QUANTITY_SATS: u64 = TWENTY_MILLION_SATS;
    const PREMIUM_SATS: u64 = ACCEPT_QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const ACCEPT_TRANSFER_COUNT: u64 = 2;
    const ACCEPT_TRANSFER_FEES: u64 = ACCEPT_TRANSFER_COUNT * CKBTC_TRANSFER_FEE;

    mint_and_sync_balance(&env, &writer_profile, OFFER_QUANTITY_SATS)
        .expect("Writer balance failed");
    mint_and_sync_balance(&env, &buyer_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer balance failed");

    create_offer(
        &env,
        &writer_wallet,
        OFFER_QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    // when
    let result = accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: ACCEPT_QUANTITY_SATS,
        }],
    );

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::QUANTITY_EXCEEDS_AVAILABLE.code);
}

/// Given: Writer creates 0.2 BTC offer, partial filling disabled
/// When: Buyer attempts to accept 0.1 BTC (partial)
/// Then: Error PARTIAL_FILLING_DISABLED returned
#[test]
fn test_partial_fill_disabled_rejects_partial_quantity() {
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

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const TWENTY_MILLION_SATS: u64 = 20_000_000; // 0.2 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const BASIS_POINTS: u64 = 10_000;
    const CKBTC_TRANSFER_FEE: u64 = 10;
    const FIRST_OFFER_ID: u64 = 1;

    const OFFER_QUANTITY_SATS: u64 = TWENTY_MILLION_SATS;
    const ACCEPT_QUANTITY_SATS: u64 = TEN_MILLION_SATS;
    const PREMIUM_SATS: u64 = ACCEPT_QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const ACCEPT_TRANSFER_COUNT: u64 = 2;
    const ACCEPT_TRANSFER_FEES: u64 = ACCEPT_TRANSFER_COUNT * CKBTC_TRANSFER_FEE;

    mint_and_sync_balance(&env, &writer_profile, OFFER_QUANTITY_SATS)
        .expect("Writer balance failed");
    mint_and_sync_balance(&env, &buyer_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer balance failed");

    create_offer(
        &env,
        &writer_wallet,
        OFFER_QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    // when
    let result = accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: ACCEPT_QUANTITY_SATS,
        }],
    );

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::PARTIAL_FILLING_DISABLED.code);
}

/// Given: Writer creates 0.3 BTC offer, partial filling enabled
/// When: Buyer 1 accepts 10M, Buyer 2 accepts 10M, Buyer 3 accepts 10M
/// Then: Three options created, offer status is Filled
#[test]
fn test_multiple_partial_fills_exhaust_offer() {
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
    const BUYER_1_SEED: u64 = 2;
    const BUYER_2_SEED: u64 = 3;
    const BUYER_3_SEED: u64 = 4;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_1_wallet = generate_wallet(BUYER_1_SEED);
    let buyer_2_wallet = generate_wallet(BUYER_2_SEED);
    let buyer_3_wallet = generate_wallet(BUYER_3_SEED);

    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_1_profile = create_account(&env, &buyer_1_wallet).expect("Buyer 1 account failed");
    let buyer_2_profile = create_account(&env, &buyer_2_wallet).expect("Buyer 2 account failed");
    let buyer_3_profile = create_account(&env, &buyer_3_wallet).expect("Buyer 3 account failed");

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const THIRTY_MILLION_SATS: u64 = 30_000_000; // 0.3 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const BASIS_POINTS: u64 = 10_000;
    const CKBTC_TRANSFER_FEE: u64 = 10;
    const FIRST_OFFER_ID: u64 = 1;

    const TOTAL_QUANTITY_SATS: u64 = THIRTY_MILLION_SATS;
    const FILL_QUANTITY_SATS: u64 = TEN_MILLION_SATS;
    const PREMIUM_PER_FILL_SATS: u64 = FILL_QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const ACCEPT_TRANSFER_COUNT: u64 = 2;
    const ACCEPT_TRANSFER_FEES: u64 = ACCEPT_TRANSFER_COUNT * CKBTC_TRANSFER_FEE;

    mint_and_sync_balance(&env, &writer_profile, TOTAL_QUANTITY_SATS)
        .expect("Writer balance failed");
    mint_and_sync_balance(
        &env,
        &buyer_1_profile,
        PREMIUM_PER_FILL_SATS + ACCEPT_TRANSFER_FEES,
    )
    .expect("Buyer 1 balance failed");
    mint_and_sync_balance(
        &env,
        &buyer_2_profile,
        PREMIUM_PER_FILL_SATS + ACCEPT_TRANSFER_FEES,
    )
    .expect("Buyer 2 balance failed");
    mint_and_sync_balance(
        &env,
        &buyer_3_profile,
        PREMIUM_PER_FILL_SATS + ACCEPT_TRANSFER_FEES,
    )
    .expect("Buyer 3 balance failed");

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
    let buyer_1_result = accept_offers(
        &env,
        &buyer_1_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: FILL_QUANTITY_SATS,
        }],
    )
    .expect("Buyer 1 accept failed");

    let buyer_2_result = accept_offers(
        &env,
        &buyer_2_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: FILL_QUANTITY_SATS,
        }],
    )
    .expect("Buyer 2 accept failed");

    let buyer_3_result = accept_offers(
        &env,
        &buyer_3_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: FILL_QUANTITY_SATS,
        }],
    )
    .expect("Buyer 3 accept failed");

    // then
    assert_eq!(buyer_1_result.active_options.len(), 1);
    assert_eq!(
        buyer_1_result.active_options[0].quantity,
        FILL_QUANTITY_SATS
    );

    assert_eq!(buyer_2_result.active_options.len(), 1);
    assert_eq!(
        buyer_2_result.active_options[0].quantity,
        FILL_QUANTITY_SATS
    );

    assert_eq!(buyer_3_result.active_options.len(), 1);
    assert_eq!(
        buyer_3_result.active_options[0].quantity,
        FILL_QUANTITY_SATS
    );

    let offers = get_open_offers(&env);
    assert_eq!(offers.len(), 0);
}

/// Given: Writer has 0.2 BTC, creates offer for 10M, buyer accepts it
/// When: Writer creates second offer for 10M, second buyer accepts it
/// Then: Writer's collateral is locked cumulatively
#[test]
fn test_accepted_offers_lock_cumulative_collateral() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 1;
    const BUYER_1_SEED: u64 = 2;
    const BUYER_2_SEED: u64 = 3;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_1_wallet = generate_wallet(BUYER_1_SEED);
    let buyer_2_wallet = generate_wallet(BUYER_2_SEED);

    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_1_profile = create_account(&env, &buyer_1_wallet).expect("Buyer 1 account failed");
    let buyer_2_profile = create_account(&env, &buyer_2_wallet).expect("Buyer 2 account failed");

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const TWENTY_MILLION_SATS: u64 = 20_000_000; // 0.2 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const BASIS_POINTS: u64 = 10_000;
    const CKBTC_TRANSFER_FEE: u64 = 10;
    const FIRST_OFFER_ID: u64 = 1;
    const SECOND_OFFER_ID: u64 = 2;
    const PREMIUM_FEE_BPS: u64 = 500;

    const PREMIUM_SATS: u64 = TEN_MILLION_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const PREMIUM_FEE_SATS: u64 = PREMIUM_SATS * PREMIUM_FEE_BPS / BASIS_POINTS;
    const NET_PREMIUM_SATS: u64 = PREMIUM_SATS - PREMIUM_FEE_SATS;
    const ACCEPT_TRANSFER_COUNT: u64 = 2;
    const ACCEPT_TRANSFER_FEES: u64 = ACCEPT_TRANSFER_COUNT * CKBTC_TRANSFER_FEE;

    mint_and_sync_balance(&env, &writer_profile, TWENTY_MILLION_SATS)
        .expect("Writer balance failed");
    mint_and_sync_balance(&env, &buyer_1_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer 1 balance failed");
    mint_and_sync_balance(&env, &buyer_2_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer 2 balance failed");

    create_offer(
        &env,
        &writer_wallet,
        TEN_MILLION_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("First offer failed");

    accept_offers(
        &env,
        &buyer_1_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: TEN_MILLION_SATS,
        }],
    )
    .expect("First accept failed");

    let writer_balance_after_first =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    assert_eq!(writer_balance_after_first.locked, TEN_MILLION_SATS);
    assert_eq!(
        writer_balance_after_first.available,
        TEN_MILLION_SATS + NET_PREMIUM_SATS
    );

    create_offer(
        &env,
        &writer_wallet,
        TEN_MILLION_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Second offer failed");

    // when
    accept_offers(
        &env,
        &buyer_2_wallet,
        vec![AcceptOfferItem {
            offer_id: SECOND_OFFER_ID,
            quantity: TEN_MILLION_SATS,
        }],
    )
    .expect("Second accept failed");

    // then
    let writer_balance_after_second =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    assert_eq!(writer_balance_after_second.locked, TWENTY_MILLION_SATS);
    assert_eq!(writer_balance_after_second.available, NET_PREMIUM_SATS * 2);
}

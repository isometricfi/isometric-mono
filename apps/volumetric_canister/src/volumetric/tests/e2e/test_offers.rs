use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    accept_offers, cancel_offer, configure_test_ledger, create_account, create_offer,
    get_events_for_principal, get_open_offers, mint_and_sync_balance, whitelist_controller,
};
use volumetric::errors::error_codes;
use volumetric::{AcceptOfferItem, EventData, EventType, OfferStatus};

/// Given: Writer with 0.1 BTC balance
/// When: Writer creates offer with strike +5%, premium 1%, 1 day expiry
/// Then: Offer appears in open offers with correct parameters, OfferCreated event emitted
#[test]
fn test_writer_creates_offer_and_it_appears_in_open_offers() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 1;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Account creation failed");

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const QUANTITY_SATS: u64 = TEN_MILLION_SATS;

    mint_and_sync_balance(&env, &writer_profile, QUANTITY_SATS).expect("Mint balance failed");

    // when
    let result = create_offer(
        &env,
        &writer_wallet,
        QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    );

    // then
    const EXPECTED_OFFER_ID: u64 = 1;
    const EXPECTED_OFFERS_COUNT: usize = 1;

    let response = result.expect("Offer creation failed");
    assert_eq!(response.offer.id, EXPECTED_OFFER_ID);
    assert_eq!(response.offer.total_quantity, QUANTITY_SATS);
    assert_eq!(response.offer.remaining_quantity, QUANTITY_SATS);
    assert_eq!(response.offer.status, OfferStatus::Open);
    assert_eq!(response.offer.strike_basis_points, STRIKE_BPS);
    assert_eq!(response.offer.premium_basis_points, PREMIUM_BPS);

    let offers = get_open_offers(&env);
    assert_eq!(offers.len(), EXPECTED_OFFERS_COUNT);
    assert_eq!(offers[0].id, EXPECTED_OFFER_ID);

    let events = get_events_for_principal(&env, writer_profile.principal);
    let offer_events: Vec<_> = events
        .iter()
        .filter(|e| e.event_type == EventType::OfferCreated)
        .collect();
    assert_eq!(offer_events.len(), 1);
    assert_eq!(
        offer_events[0].data,
        EventData::OfferCreated {
            offer_id: EXPECTED_OFFER_ID,
            quantity_sats: QUANTITY_SATS,
            strike_basis_points: STRIKE_BPS,
            premium_basis_points: PREMIUM_BPS,
            duration_seconds: ONE_DAY_SECS,
            offer_valid_until_ns: response.offer.offer_valid_until,
        }
    );
}

/// Given: Writer creates an offer
/// When: Writer cancels the offer
/// Then: Offer status is Cancelled, OfferCancelled event emitted
#[test]
fn test_writer_cancels_open_offer_successfully() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 1;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Account creation failed");

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const QUANTITY_SATS: u64 = TEN_MILLION_SATS;
    const FIRST_OFFER_ID: u64 = 1;

    mint_and_sync_balance(&env, &writer_profile, QUANTITY_SATS).expect("Mint balance failed");

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
    let result = cancel_offer(&env, &writer_wallet, FIRST_OFFER_ID);

    // then
    let cancelled_offer = result.expect("Cancel offer failed");
    assert_eq!(cancelled_offer.id, FIRST_OFFER_ID);
    assert_eq!(cancelled_offer.status, OfferStatus::Cancelled);

    let offers = get_open_offers(&env);
    assert_eq!(offers.len(), 0);

    let events = get_events_for_principal(&env, writer_profile.principal);
    let cancel_events: Vec<_> = events
        .iter()
        .filter(|e| e.event_type == EventType::OfferCancelled)
        .collect();
    assert_eq!(cancel_events.len(), 1);
    assert_eq!(
        cancel_events[0].data,
        EventData::OfferCancelled {
            offer_id: FIRST_OFFER_ID,
            remaining_quantity_sats: QUANTITY_SATS,
        }
    );
}

/// Given: Writer A creates an offer
/// When: Writer B attempts to cancel it
/// Then: Error NOT_OFFER_OWNER returned
#[test]
fn test_cancel_offer_fails_for_non_owner() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_A_SEED: u64 = 1;
    const WRITER_B_SEED: u64 = 2;
    let writer_a_wallet = generate_wallet(WRITER_A_SEED);
    let writer_b_wallet = generate_wallet(WRITER_B_SEED);

    let writer_a_profile = create_account(&env, &writer_a_wallet).expect("Writer A account failed");
    create_account(&env, &writer_b_wallet).expect("Writer B account failed");

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const QUANTITY_SATS: u64 = TEN_MILLION_SATS;
    const FIRST_OFFER_ID: u64 = 1;

    mint_and_sync_balance(&env, &writer_a_profile, QUANTITY_SATS).expect("Mint balance failed");

    create_offer(
        &env,
        &writer_a_wallet,
        QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    // when
    let result = cancel_offer(&env, &writer_b_wallet, FIRST_OFFER_ID);

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::NOT_OFFER_OWNER.code);
}

/// Given: Writer creates and cancels an offer
/// When: Writer attempts to cancel again
/// Then: Error OFFER_CANCELLED returned
#[test]
fn test_cancel_already_cancelled_offer_fails() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 1;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Account creation failed");

    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const QUANTITY_SATS: u64 = TEN_MILLION_SATS;
    const FIRST_OFFER_ID: u64 = 1;

    mint_and_sync_balance(&env, &writer_profile, QUANTITY_SATS).expect("Mint balance failed");

    create_offer(
        &env,
        &writer_wallet,
        QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    cancel_offer(&env, &writer_wallet, FIRST_OFFER_ID).expect("First cancel failed");

    // when
    let result = cancel_offer(&env, &writer_wallet, FIRST_OFFER_ID);

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::OFFER_CANCELLED.code);
}

/// Given: Writer creates offer, buyer fully accepts it
/// When: Writer attempts to cancel the filled offer
/// Then: Error OFFER_FILLED returned
#[test]
fn test_cancel_filled_offer_fails() {
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

    accept_offers(
        &env,
        &buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    )
    .expect("Accept offer failed");

    // when
    let result = cancel_offer(&env, &writer_wallet, FIRST_OFFER_ID);

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::OFFER_FILLED.code);
}

/// Given: Writer has 0.05 BTC balance
/// When: Writer attempts to create 0.1 BTC offer
/// Then: Error INSUFFICIENT_BALANCE returned
#[test]
fn test_create_offer_with_insufficient_balance_fails() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 1;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Account creation failed");

    const FIVE_MILLION_SATS: u64 = 5_000_000; // 0.05 BTC
    const TEN_MILLION_SATS: u64 = 10_000_000; // 0.1 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;

    mint_and_sync_balance(&env, &writer_profile, FIVE_MILLION_SATS).expect("Mint balance failed");

    // when
    let result = create_offer(
        &env,
        &writer_wallet,
        TEN_MILLION_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    );

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::INSUFFICIENT_BALANCE.code);
}

/// Given: Writer creates max offers (5) for same strike/duration
/// When: Writer attempts to create another offer with same terms
/// Then: Error OFFER_LIMIT_EXCEEDED returned
#[test]
fn test_create_offer_exceeds_limit_per_term_fails() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 1;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Account creation failed");

    const ONE_MILLION_SATS: u64 = 1_000_000; // 0.01 BTC
    const STRIKE_BPS: u16 = 500;
    const PREMIUM_BPS: u16 = 100;
    const ONE_DAY_SECS: u64 = 86_400;
    const MAX_OFFERS_PER_TERM: usize = 5;
    const TOTAL_BALANCE_SATS: u64 = ONE_MILLION_SATS * (MAX_OFFERS_PER_TERM as u64 + 1);

    mint_and_sync_balance(&env, &writer_profile, TOTAL_BALANCE_SATS).expect("Mint balance failed");

    for _ in 0..MAX_OFFERS_PER_TERM {
        create_offer(
            &env,
            &writer_wallet,
            ONE_MILLION_SATS,
            STRIKE_BPS,
            PREMIUM_BPS,
            ONE_DAY_SECS,
        )
        .expect("Create offer failed");
    }

    // when
    let result = create_offer(
        &env,
        &writer_wallet,
        ONE_MILLION_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    );

    // then
    assert!(result.is_err());
    let error = result.unwrap_err();
    assert_eq!(error.code, error_codes::OFFER_LIMIT_EXCEEDED.code);
}

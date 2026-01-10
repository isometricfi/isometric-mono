use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    configure_test_ledger, create_account, create_offer, get_events_for_principal, get_open_offers,
    mint_and_sync_balance, whitelist_controller,
};
use volumetric::{EventData, EventType, OfferStatus};

/// Given: Writer with 10M sats balance
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

    const TEN_MILLION_SATS: u64 = 10_000_000;
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

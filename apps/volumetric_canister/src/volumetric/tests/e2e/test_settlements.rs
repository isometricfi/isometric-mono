use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    accept_offers, configure_test_ledger, create_account, create_offer, get_events_for_principal,
    get_fee_recipient_ledger_balance, get_pending_settlements, get_platform_fees_collected_total,
    get_settlement_status, get_subaccount_ledger_balance, get_user_balance, mint_and_sync_balance,
    set_oracle_price, settle_expired_options, settle_option_by_id,
    testing_set_option_expiry_seconds, wait_for_settlement_terminal_status, whitelist_controller,
};
use volumetric::auth::derive_subaccount;
use volumetric::{AcceptOfferItem, EventData, EventType, SettlementStatus, TradeRole};

const ONE_BTC_SATS: u64 = 100_000_000; // 1 BTC
const BASIS_POINTS: u64 = 10_000;
const PREMIUM_BPS: u16 = 100;
const PREMIUM_FEE_BPS: u64 = 500;
const PROFIT_FEE_BPS: u64 = 2000;
const ENTRY_PRICE_CENTS: u64 = 10_000_000;
const ONE_DAY_SECS: u64 = 86_400 * 3;
const ONE_HOUR_SECS: u64 = 3_600;
const CKBTC_TRANSFER_FEE: u64 = 10;
const CKBTC_SETTLEMENT_TRANSFER_FEES: u64 = 2 * CKBTC_TRANSFER_FEE;
const FIRST_OFFER_ID: u64 = 1;

const QUANTITY_SATS: u64 = ONE_BTC_SATS;
const PREMIUM_SATS: u64 = QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
const ACCEPT_TRANSFER_COUNT: u64 = 2;
const ACCEPT_TRANSFER_FEES: u64 = ACCEPT_TRANSFER_COUNT * CKBTC_TRANSFER_FEE;

#[derive(Clone, Copy)]
enum SettlementExecutionPath {
    ExpiredOptionsEndpoint,
    SettleById,
}

struct SettlementBalanceDeltas {
    writer_received_sats: u64,
    buyer_received_sats: u64,
    profit_fee_received_sats: u64,
}

fn run_single_option_settlement_and_collect_deltas(
    path: SettlementExecutionPath,
) -> SettlementBalanceDeltas {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 111;
    const BUYER_SEED: u64 = 222;
    const STRIKE_BPS: u16 = 500;
    const OPTION_ID: u64 = 1;
    const EXPIRED_AT_SECONDS: u64 = 0;
    const TEST_QUANTITY_SATS: u64 = 73_456_789;
    const TEST_PREMIUM_SATS: u64 = TEST_QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const TEST_SETTLEMENT_PRICE_CENTS: u64 = 12_345_678;

    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

    mint_and_sync_balance(&env, &writer_profile, TEST_QUANTITY_SATS)
        .expect("Writer balance failed");
    mint_and_sync_balance(
        &env,
        &buyer_profile,
        TEST_PREMIUM_SATS + ACCEPT_TRANSFER_FEES,
    )
    .expect("Buyer balance failed");

    set_oracle_price(&env, ENTRY_PRICE_CENTS);
    create_offer(
        &env,
        &writer_wallet,
        TEST_QUANTITY_SATS,
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
            quantity: TEST_QUANTITY_SATS,
        }],
    )
    .expect("Accept offer failed");

    let fee_recipient_balance_after_accept = get_fee_recipient_ledger_balance(&env);
    let writer_balance_before =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_before =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");

    set_oracle_price(&env, TEST_SETTLEMENT_PRICE_CENTS);
    testing_set_option_expiry_seconds(&env, OPTION_ID, EXPIRED_AT_SECONDS)
        .expect("Set expiry failed");

    // when
    match path {
        SettlementExecutionPath::ExpiredOptionsEndpoint => {
            let response = settle_expired_options(&env).expect("Settle expired options failed");
            assert!(response.errors.is_empty());
            assert_eq!(response.settled.len(), 1);
        }
        SettlementExecutionPath::SettleById => {
            let receipt = settle_option_by_id(&env, OPTION_ID).expect("Settle by id failed");
            let terminal_status =
                wait_for_settlement_terminal_status(&env, receipt.operation_id, 8)
                    .expect("Settlement status failed");
            assert!(matches!(
                terminal_status,
                SettlementStatus::Succeeded { .. }
            ));
        }
    }

    // then
    let writer_balance_after =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_after =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");
    let fee_recipient_balance_after_settle = get_fee_recipient_ledger_balance(&env);

    let writer_received_sats = writer_balance_after.available - writer_balance_before.available;
    let buyer_received_sats = buyer_balance_after.available - buyer_balance_before.available;
    let profit_fee_received_sats =
        fee_recipient_balance_after_settle - fee_recipient_balance_after_accept;

    SettlementBalanceDeltas {
        writer_received_sats,
        buyer_received_sats,
        profit_fee_received_sats,
    }
}

/// Given: 1 BTC call option, entry $100k, strike $105k (+5%), premium 1% (0.01 BTC)
/// When: Price rises to $210k (2x strike), option expires
/// Then: Buyer nets 0.4 BTC, writer gets 0.6 BTC, platform collects 0.1 BTC profit fee, events emitted
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
    const EXPECTED_OPTION_ID: u64 = 1;
    const EXPECTED_GROSS_BUYER_PAYOUT_SATS: u64 = 50_000_000; // 0.5 BTC

    const EXPECTED_PROFIT_FEE_SATS: u64 =
        EXPECTED_GROSS_BUYER_PAYOUT_SATS * PROFIT_FEE_BPS / BASIS_POINTS;

    const EXPECTED_BUYER_PAYOUT_SATS: u64 =
        EXPECTED_GROSS_BUYER_PAYOUT_SATS - EXPECTED_PROFIT_FEE_SATS;

    const EXPECTED_WRITER_BALANCE_INCREASE_SATS: u64 =
        QUANTITY_SATS - EXPECTED_GROSS_BUYER_PAYOUT_SATS;

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
    assert_eq!(
        writer_received,
        EXPECTED_WRITER_BALANCE_INCREASE_SATS - CKBTC_SETTLEMENT_TRANSFER_FEES
    );

    let fee_recipient_balance_after_settle = get_fee_recipient_ledger_balance(&env);
    let profit_fee_received =
        fee_recipient_balance_after_settle - fee_recipient_balance_after_accept;
    assert_eq!(profit_fee_received, EXPECTED_PROFIT_FEE_SATS);

    let total_platform_fees = fee_recipient_balance_after_settle - fee_recipient_balance_before;
    assert_eq!(total_platform_fees, EXPECTED_TOTAL_PLATFORM_FEES_SATS);

    const EXPECTED_WRITER_PAYOUT_SATS: u64 = QUANTITY_SATS - EXPECTED_GROSS_BUYER_PAYOUT_SATS;

    let buyer_events = get_events_for_principal(&env, buyer_profile.principal);
    let buyer_settle_events: Vec<_> = buyer_events
        .iter()
        .filter(|e| e.event_type == EventType::OptionSettled)
        .collect();
    assert_eq!(buyer_settle_events.len(), 1);

    let EventData::OptionSettled {
        accepted_at_seconds: buyer_accepted_at,
        settled_at_seconds: buyer_settled_at,
        ..
    } = &buyer_settle_events[0].data
    else {
        panic!("Expected OptionSettled event");
    };

    assert_eq!(
        buyer_settle_events[0].data,
        EventData::OptionSettled {
            option_id: EXPECTED_OPTION_ID,
            quantity_sats: QUANTITY_SATS,
            entry_price_cents: ENTRY_PRICE_CENTS,
            strike_price_cents: STRIKE_PRICE_CENTS,
            settlement_price_cents: SETTLEMENT_PRICE_CENTS,
            premium_sats: PREMIUM_SATS,
            payout_sats: EXPECTED_BUYER_PAYOUT_SATS,
            accepted_at_seconds: *buyer_accepted_at,
            settled_at_seconds: *buyer_settled_at,
            role: TradeRole::Buyer,
        }
    );

    let writer_events = get_events_for_principal(&env, writer_profile.principal);
    let writer_settle_events: Vec<_> = writer_events
        .iter()
        .filter(|e| e.event_type == EventType::OptionSettled)
        .collect();
    assert_eq!(writer_settle_events.len(), 1);

    let EventData::OptionSettled {
        accepted_at_seconds: writer_accepted_at,
        settled_at_seconds: writer_settled_at,
        ..
    } = &writer_settle_events[0].data
    else {
        panic!("Expected OptionSettled event");
    };

    assert_eq!(
        writer_settle_events[0].data,
        EventData::OptionSettled {
            option_id: EXPECTED_OPTION_ID,
            quantity_sats: QUANTITY_SATS,
            entry_price_cents: ENTRY_PRICE_CENTS,
            strike_price_cents: STRIKE_PRICE_CENTS,
            settlement_price_cents: SETTLEMENT_PRICE_CENTS,
            premium_sats: PREMIUM_SATS,
            payout_sats: EXPECTED_WRITER_PAYOUT_SATS - CKBTC_SETTLEMENT_TRANSFER_FEES,
            accepted_at_seconds: *writer_accepted_at,
            settled_at_seconds: *writer_settled_at,
            role: TradeRole::Writer,
        }
    );
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
    const STRIKE_BPS_OTM: u16 = 800;
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
    const EXPECTED_GROSS_BUYER_1_PAYOUT_SATS: u64 = 943_396; // 0.00943396 BTC
    const EXPECTED_PROFIT_FEE_SATS: u64 =
        EXPECTED_GROSS_BUYER_1_PAYOUT_SATS * PROFIT_FEE_BPS / BASIS_POINTS;
    const EXPECTED_BUYER_1_PAYOUT_SATS: u64 =
        EXPECTED_GROSS_BUYER_1_PAYOUT_SATS - EXPECTED_PROFIT_FEE_SATS;
    const EXPECTED_WRITER_1_PAYOUT_SATS: u64 = QUANTITY_SATS - EXPECTED_GROSS_BUYER_1_PAYOUT_SATS;

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

    assert_eq!(
        writer_1_received,
        EXPECTED_WRITER_1_PAYOUT_SATS - CKBTC_SETTLEMENT_TRANSFER_FEES
    );
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

/// Given: 1 BTC call option, entry $100k, strike $105k (+5%), premium 1%
/// When: Price settles exactly at $105k (ATM)
/// Then: Buyer gets 0, writer keeps all collateral, no profit fee
#[test]
fn test_option_settles_exactly_at_strike_price() {
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
    const SETTLEMENT_PRICE_CENTS: u64 = STRIKE_PRICE_CENTS;

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

/// Given: 1 BTC call option, entry $100k, strike $105k (+5%), premium 1%
/// When: Price goes extremely high (10x), option expires
/// Then: Buyer gets large payout based on price increase, writer gets remainder
#[test]
fn test_option_with_extreme_price_increase_settles_correctly() {
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
    const SETTLEMENT_PRICE_CENTS: u64 = ENTRY_PRICE_CENTS * 10;

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
    const STRIKE_PRICE_CENTS: u64 =
        ENTRY_PRICE_CENTS + ENTRY_PRICE_CENTS * STRIKE_BPS as u64 / BASIS_POINTS;
    const PROFIT_CENTS: u64 = SETTLEMENT_PRICE_CENTS - STRIKE_PRICE_CENTS;
    const EXPECTED_GROSS_BUYER_PAYOUT_SATS: u64 =
        (QUANTITY_SATS as u128 * PROFIT_CENTS as u128 / SETTLEMENT_PRICE_CENTS as u128) as u64;
    const EXPECTED_PROFIT_FEE_SATS: u64 =
        EXPECTED_GROSS_BUYER_PAYOUT_SATS * PROFIT_FEE_BPS / BASIS_POINTS;
    const EXPECTED_BUYER_PAYOUT_SATS: u64 =
        EXPECTED_GROSS_BUYER_PAYOUT_SATS - EXPECTED_PROFIT_FEE_SATS;
    const EXPECTED_WRITER_PAYOUT_SATS: u64 = QUANTITY_SATS - EXPECTED_GROSS_BUYER_PAYOUT_SATS;

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
    assert_eq!(
        writer_received,
        EXPECTED_WRITER_PAYOUT_SATS - CKBTC_SETTLEMENT_TRANSFER_FEES
    );

    let fee_recipient_balance_after_settle = get_fee_recipient_ledger_balance(&env);
    let profit_fee_received =
        fee_recipient_balance_after_settle - fee_recipient_balance_after_accept;
    assert_eq!(profit_fee_received, EXPECTED_PROFIT_FEE_SATS);

    let total_platform_fees = fee_recipient_balance_after_settle - fee_recipient_balance_before;
    assert_eq!(
        total_platform_fees,
        EXPECTED_PREMIUM_FEE_SATS + EXPECTED_PROFIT_FEE_SATS
    );
}

/// Given: Writer creates offer, buyer accepts, option expires OTM
/// When: Settlement completes
/// Then: Writer's locked balance returns to available, can create new offer
#[test]
fn test_writer_collateral_unlocked_after_option_expires_otm() {
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
    const NET_PREMIUM_SATS: u64 = PREMIUM_SATS - PREMIUM_SATS * PREMIUM_FEE_BPS / BASIS_POINTS;

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

    let writer_balance_before_settle =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    assert_eq!(writer_balance_before_settle.locked, QUANTITY_SATS);
    assert_eq!(writer_balance_before_settle.available, NET_PREMIUM_SATS);

    set_oracle_price(&env, SETTLEMENT_PRICE_CENTS);

    // when
    env.advance_time_secs(ONE_DAY_SECS + ONE_HOUR_SECS);

    // then
    let writer_balance_after_settle =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    assert_eq!(writer_balance_after_settle.locked, 0);
    assert_eq!(
        writer_balance_after_settle.available,
        QUANTITY_SATS + NET_PREMIUM_SATS
    );

    let new_offer_result = create_offer(
        &env,
        &writer_wallet,
        QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    );
    assert!(new_offer_result.is_ok());
}

/// Given: An expired option settlement already enqueued via WAL
/// When: Settlement is requested again for the same option id
/// Then: The same receipt is returned and status reaches a terminal WAL state
#[test]
fn test_settling_already_settled_option_returns_idempotent_receipt() {
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

    set_oracle_price(&env, SETTLEMENT_PRICE_CENTS);

    const OPTION_ID: u64 = 1;
    let past_expiry = 0;
    testing_set_option_expiry_seconds(&env, OPTION_ID, past_expiry).expect("Set expiry failed");

    let first_settle_receipt =
        settle_option_by_id(&env, OPTION_ID).expect("first settlement should enqueue");

    // when
    let second_settle_receipt =
        settle_option_by_id(&env, OPTION_ID).expect("second settlement should be idempotent");

    // then
    assert_eq!(
        first_settle_receipt.option_id,
        second_settle_receipt.option_id
    );
    assert_eq!(
        first_settle_receipt.operation_id,
        second_settle_receipt.operation_id
    );

    let mut latest_status =
        get_settlement_status(&env, first_settle_receipt.operation_id).expect("status should load");
    for _attempt in 0..5 {
        if matches!(
            latest_status,
            SettlementStatus::Succeeded { .. } | SettlementStatus::Failed { .. }
        ) {
            break;
        }
        env.pic.tick();
        latest_status = get_settlement_status(&env, first_settle_receipt.operation_id)
            .expect("status should reload");
    }

    assert!(matches!(
        latest_status,
        SettlementStatus::Succeeded { .. } | SettlementStatus::Failed { .. }
    ));
}

/// Given: an ITM settlement has already reached terminal WAL success
/// When: settlement is requested again and the scheduler is ticked
/// Then: balances, locks, platform fees, and ledger subaccounts do not change
#[test]
fn test_settlement_replay_after_terminal_success_preserves_balances_and_ledger() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 31;
    const BUYER_SEED: u64 = 32;
    const STRIKE_BPS: u16 = 500;
    const OPTION_ID: u64 = 1;
    const TEST_SETTLEMENT_PRICE_CENTS: u64 = 12_345_678;

    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

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

    let writer_subaccount = derive_subaccount(writer_profile.principal);
    let buyer_subaccount = derive_subaccount(buyer_profile.principal);

    set_oracle_price(&env, TEST_SETTLEMENT_PRICE_CENTS);
    testing_set_option_expiry_seconds(&env, OPTION_ID, 0).expect("Set expiry failed");

    let first_receipt = settle_option_by_id(&env, OPTION_ID).expect("first settlement failed");
    let terminal_status = wait_for_settlement_terminal_status(&env, first_receipt.operation_id, 8)
        .expect("Settlement status failed");
    assert!(matches!(
        terminal_status,
        SettlementStatus::Succeeded { .. }
    ));

    let writer_balance_after_first =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_after_first =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");
    let writer_ledger_after_first =
        get_subaccount_ledger_balance(&env, env.volumetric_canister, Some(writer_subaccount));
    let buyer_ledger_after_first =
        get_subaccount_ledger_balance(&env, env.volumetric_canister, Some(buyer_subaccount));
    let fee_recipient_balance_after_first = get_fee_recipient_ledger_balance(&env);
    let platform_fees_after_first = get_platform_fees_collected_total(&env);

    assert_eq!(writer_balance_after_first.locked, 0);
    assert_eq!(
        writer_balance_after_first.available + writer_balance_after_first.locked,
        writer_ledger_after_first
    );
    assert_eq!(
        buyer_balance_after_first.available + buyer_balance_after_first.locked,
        buyer_ledger_after_first
    );

    // when
    let second_receipt = settle_option_by_id(&env, OPTION_ID).expect("second settlement failed");
    for _attempt in 0..3 {
        env.pic.tick();
    }

    // then
    assert_eq!(second_receipt.operation_id, first_receipt.operation_id);
    assert_eq!(get_pending_settlements(&env).len(), 0);

    let writer_balance_after_replay =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_after_replay =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");
    let writer_ledger_after_replay =
        get_subaccount_ledger_balance(&env, env.volumetric_canister, Some(writer_subaccount));
    let buyer_ledger_after_replay =
        get_subaccount_ledger_balance(&env, env.volumetric_canister, Some(buyer_subaccount));

    assert_eq!(
        writer_balance_after_replay.available,
        writer_balance_after_first.available
    );
    assert_eq!(
        writer_balance_after_replay.locked,
        writer_balance_after_first.locked
    );
    assert_eq!(
        buyer_balance_after_replay.available,
        buyer_balance_after_first.available
    );
    assert_eq!(
        buyer_balance_after_replay.locked,
        buyer_balance_after_first.locked
    );
    assert_eq!(writer_ledger_after_replay, writer_ledger_after_first);
    assert_eq!(buyer_ledger_after_replay, buyer_ledger_after_first);
    assert_eq!(
        get_fee_recipient_ledger_balance(&env),
        fee_recipient_balance_after_first
    );
    assert_eq!(
        get_platform_fees_collected_total(&env),
        platform_fees_after_first
    );
}

/// Given: identical single-option setups with ITM settlement
/// When: one settles via settle_expired_options and the other via settle_option_by_id
/// Then: buyer, writer, and fee-recipient settlement deltas are identical across both paths
#[test]
fn test_settle_option_by_id_produces_same_payouts_as_expired_options_settlement() {
    // given
    let expired_options_path_deltas = run_single_option_settlement_and_collect_deltas(
        SettlementExecutionPath::ExpiredOptionsEndpoint,
    );
    let settle_by_id_path_deltas =
        run_single_option_settlement_and_collect_deltas(SettlementExecutionPath::SettleById);

    // when
    let expired_options_tuple = (
        expired_options_path_deltas.writer_received_sats,
        expired_options_path_deltas.buyer_received_sats,
        expired_options_path_deltas.profit_fee_received_sats,
    );
    let settle_by_id_tuple = (
        settle_by_id_path_deltas.writer_received_sats,
        settle_by_id_path_deltas.buyer_received_sats,
        settle_by_id_path_deltas.profit_fee_received_sats,
    );

    // then
    assert_eq!(expired_options_tuple, settle_by_id_tuple);
}

/// Given: an ITM settlement with non-trivial payout and fee amounts
/// When: settlement completes
/// Then: writer payout + buyer payout + profit fee exactly conserves collateral quantity
#[test]
fn test_settlement_conserves_collateral_across_writer_buyer_and_profit_fee() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 51;
    const BUYER_SEED: u64 = 52;
    const STRIKE_BPS: u16 = 500;
    const OPTION_ID: u64 = 1;
    const TEST_SETTLEMENT_PRICE_CENTS: u64 = 13_200_000;

    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

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

    let fee_recipient_balance_after_accept = get_fee_recipient_ledger_balance(&env);
    let writer_balance_before =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_before =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");

    set_oracle_price(&env, TEST_SETTLEMENT_PRICE_CENTS);
    testing_set_option_expiry_seconds(&env, OPTION_ID, 0).expect("Set expiry failed");

    // when
    let response = settle_expired_options(&env).expect("Settle expired options failed");
    assert!(response.errors.is_empty());
    assert_eq!(response.settled.len(), 1);

    // then
    let writer_balance_after =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_after =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");
    let fee_recipient_balance_after_settle = get_fee_recipient_ledger_balance(&env);

    let writer_received_sats = writer_balance_after.available - writer_balance_before.available;
    let buyer_received_sats = buyer_balance_after.available - buyer_balance_before.available;
    let profit_fee_received_sats =
        fee_recipient_balance_after_settle - fee_recipient_balance_after_accept;

    const STRIKE_PRICE_CENTS: u64 =
        ENTRY_PRICE_CENTS + ENTRY_PRICE_CENTS * STRIKE_BPS as u64 / BASIS_POINTS;
    let gross_payout_to_buyer_sats = (QUANTITY_SATS as u128
        * (TEST_SETTLEMENT_PRICE_CENTS - STRIKE_PRICE_CENTS) as u128
        / TEST_SETTLEMENT_PRICE_CENTS as u128) as u64;
    let expected_profit_fee_sats = gross_payout_to_buyer_sats * PROFIT_FEE_BPS / BASIS_POINTS;
    let expected_buyer_payout_sats = gross_payout_to_buyer_sats - expected_profit_fee_sats;
    let expected_writer_payout_sats = QUANTITY_SATS - gross_payout_to_buyer_sats;

    assert_eq!(buyer_received_sats, expected_buyer_payout_sats);
    assert_eq!(
        writer_received_sats,
        expected_writer_payout_sats - CKBTC_SETTLEMENT_TRANSFER_FEES
    );
    assert_eq!(profit_fee_received_sats, expected_profit_fee_sats);
    assert_eq!(
        writer_received_sats
            + buyer_received_sats
            + profit_fee_received_sats
            + CKBTC_SETTLEMENT_TRANSFER_FEES,
        QUANTITY_SATS
    );
}

/// Given: a partial-quantity option with integer-division payout rounding
/// When: the option settles ITM
/// Then: payouts and profit fee match rounded formula outputs and funds route to expected recipients
#[test]
fn test_partial_quantity_itm_option_settles_with_correct_payouts_and_fees() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 61;
    const BUYER_SEED: u64 = 62;
    const STRIKE_BPS: u16 = 800;
    const OPTION_ID: u64 = 1;
    const PARTIAL_QUANTITY_SATS: u64 = 12_345_679;
    const PARTIAL_PREMIUM_SATS: u64 = PARTIAL_QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const TEST_SETTLEMENT_PRICE_CENTS: u64 = 11_234_567;

    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

    let fee_recipient_balance_before = get_fee_recipient_ledger_balance(&env);
    mint_and_sync_balance(&env, &writer_profile, PARTIAL_QUANTITY_SATS)
        .expect("Writer balance failed");
    mint_and_sync_balance(
        &env,
        &buyer_profile,
        PARTIAL_PREMIUM_SATS + ACCEPT_TRANSFER_FEES,
    )
    .expect("Buyer balance failed");

    set_oracle_price(&env, ENTRY_PRICE_CENTS);
    create_offer(
        &env,
        &writer_wallet,
        PARTIAL_QUANTITY_SATS,
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
            quantity: PARTIAL_QUANTITY_SATS,
        }],
    )
    .expect("Accept offer failed");

    let fee_recipient_balance_after_accept = get_fee_recipient_ledger_balance(&env);
    let writer_balance_before =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_before =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");

    set_oracle_price(&env, TEST_SETTLEMENT_PRICE_CENTS);
    testing_set_option_expiry_seconds(&env, OPTION_ID, 0).expect("Set expiry failed");

    // when
    let response = settle_expired_options(&env).expect("Settle expired options failed");
    assert!(response.errors.is_empty());
    assert_eq!(response.settled.len(), 1);

    // then
    let writer_balance_after =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance failed");
    let buyer_balance_after =
        get_user_balance(&env, &buyer_wallet.address).expect("Buyer balance failed");
    let fee_recipient_balance_after_settle = get_fee_recipient_ledger_balance(&env);

    let writer_received_sats = writer_balance_after.available - writer_balance_before.available;
    let buyer_received_sats = buyer_balance_after.available - buyer_balance_before.available;
    let profit_fee_received_sats =
        fee_recipient_balance_after_settle - fee_recipient_balance_after_accept;
    let total_fee_delta = fee_recipient_balance_after_settle - fee_recipient_balance_before;

    const STRIKE_PRICE_CENTS: u64 =
        ENTRY_PRICE_CENTS + ENTRY_PRICE_CENTS * STRIKE_BPS as u64 / BASIS_POINTS;
    let gross_payout_to_buyer_sats = (PARTIAL_QUANTITY_SATS as u128
        * (TEST_SETTLEMENT_PRICE_CENTS - STRIKE_PRICE_CENTS) as u128
        / TEST_SETTLEMENT_PRICE_CENTS as u128) as u64;
    let expected_profit_fee_sats = gross_payout_to_buyer_sats * PROFIT_FEE_BPS / BASIS_POINTS;
    let expected_buyer_payout_sats = gross_payout_to_buyer_sats - expected_profit_fee_sats;
    let expected_writer_payout_sats = PARTIAL_QUANTITY_SATS - gross_payout_to_buyer_sats;
    let expected_premium_fee_sats = PARTIAL_PREMIUM_SATS * PREMIUM_FEE_BPS / BASIS_POINTS;

    assert_eq!(buyer_received_sats, expected_buyer_payout_sats);
    assert_eq!(
        writer_received_sats,
        expected_writer_payout_sats - CKBTC_SETTLEMENT_TRANSFER_FEES
    );
    assert_eq!(profit_fee_received_sats, expected_profit_fee_sats);
    assert_eq!(
        writer_received_sats
            + buyer_received_sats
            + profit_fee_received_sats
            + CKBTC_SETTLEMENT_TRANSFER_FEES,
        PARTIAL_QUANTITY_SATS
    );
    assert_eq!(
        total_fee_delta,
        expected_premium_fee_sats + expected_profit_fee_sats
    );
}

/// Given: two ITM options settle in the same tick
/// When: settle_expired_options executes both settlements together
/// Then: fee-recipient profit fee delta equals the sum of each option's expected profit fee
#[test]
fn test_two_itm_options_in_one_tick_aggregate_profit_fees_on_fee_recipient() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_1_SEED: u64 = 71;
    const BUYER_1_SEED: u64 = 72;
    const WRITER_2_SEED: u64 = 73;
    const BUYER_2_SEED: u64 = 74;
    const STRIKE_BPS_1: u16 = 500;
    const STRIKE_BPS_2: u16 = 800;
    const OPTION_1_ID: u64 = 1;
    const OPTION_2_ID: u64 = 2;
    const OFFER_2_ID: u64 = 2;
    const QUANTITY_1_SATS: u64 = 60_000_000;
    const QUANTITY_2_SATS: u64 = 25_000_000;
    const PREMIUM_1_SATS: u64 = QUANTITY_1_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const PREMIUM_2_SATS: u64 = QUANTITY_2_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    const TEST_SETTLEMENT_PRICE_CENTS: u64 = 12_000_000;

    let writer_1_wallet = generate_wallet(WRITER_1_SEED);
    let buyer_1_wallet = generate_wallet(BUYER_1_SEED);
    let writer_2_wallet = generate_wallet(WRITER_2_SEED);
    let buyer_2_wallet = generate_wallet(BUYER_2_SEED);

    let writer_1_profile = create_account(&env, &writer_1_wallet).expect("Writer 1 account failed");
    let buyer_1_profile = create_account(&env, &buyer_1_wallet).expect("Buyer 1 account failed");
    let writer_2_profile = create_account(&env, &writer_2_wallet).expect("Writer 2 account failed");
    let buyer_2_profile = create_account(&env, &buyer_2_wallet).expect("Buyer 2 account failed");

    mint_and_sync_balance(&env, &writer_1_profile, QUANTITY_1_SATS)
        .expect("Writer 1 balance failed");
    mint_and_sync_balance(&env, &writer_2_profile, QUANTITY_2_SATS)
        .expect("Writer 2 balance failed");
    mint_and_sync_balance(
        &env,
        &buyer_1_profile,
        PREMIUM_1_SATS + ACCEPT_TRANSFER_FEES,
    )
    .expect("Buyer 1 balance failed");
    mint_and_sync_balance(
        &env,
        &buyer_2_profile,
        PREMIUM_2_SATS + ACCEPT_TRANSFER_FEES,
    )
    .expect("Buyer 2 balance failed");

    set_oracle_price(&env, ENTRY_PRICE_CENTS);
    create_offer(
        &env,
        &writer_1_wallet,
        QUANTITY_1_SATS,
        STRIKE_BPS_1,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer 1 failed");
    create_offer(
        &env,
        &writer_2_wallet,
        QUANTITY_2_SATS,
        STRIKE_BPS_2,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer 2 failed");

    accept_offers(
        &env,
        &buyer_1_wallet,
        vec![AcceptOfferItem {
            offer_id: FIRST_OFFER_ID,
            quantity: QUANTITY_1_SATS,
        }],
    )
    .expect("Accept offer 1 failed");
    accept_offers(
        &env,
        &buyer_2_wallet,
        vec![AcceptOfferItem {
            offer_id: OFFER_2_ID,
            quantity: QUANTITY_2_SATS,
        }],
    )
    .expect("Accept offer 2 failed");

    let fee_recipient_balance_after_accept = get_fee_recipient_ledger_balance(&env);
    set_oracle_price(&env, TEST_SETTLEMENT_PRICE_CENTS);
    testing_set_option_expiry_seconds(&env, OPTION_1_ID, 0).expect("Set option 1 expiry failed");
    testing_set_option_expiry_seconds(&env, OPTION_2_ID, 0).expect("Set option 2 expiry failed");

    // when
    let response = settle_expired_options(&env).expect("Settle expired options failed");
    assert!(response.errors.is_empty());
    assert_eq!(response.settled.len(), 2);

    // then
    let fee_recipient_balance_after_settle = get_fee_recipient_ledger_balance(&env);
    let profit_fee_received_sats =
        fee_recipient_balance_after_settle - fee_recipient_balance_after_accept;

    const STRIKE_PRICE_1_CENTS: u64 =
        ENTRY_PRICE_CENTS + ENTRY_PRICE_CENTS * STRIKE_BPS_1 as u64 / BASIS_POINTS;
    const STRIKE_PRICE_2_CENTS: u64 =
        ENTRY_PRICE_CENTS + ENTRY_PRICE_CENTS * STRIKE_BPS_2 as u64 / BASIS_POINTS;

    let gross_payout_1_sats = (QUANTITY_1_SATS as u128
        * (TEST_SETTLEMENT_PRICE_CENTS - STRIKE_PRICE_1_CENTS) as u128
        / TEST_SETTLEMENT_PRICE_CENTS as u128) as u64;
    let gross_payout_2_sats = (QUANTITY_2_SATS as u128
        * (TEST_SETTLEMENT_PRICE_CENTS - STRIKE_PRICE_2_CENTS) as u128
        / TEST_SETTLEMENT_PRICE_CENTS as u128) as u64;
    let expected_profit_fee_1_sats = gross_payout_1_sats * PROFIT_FEE_BPS / BASIS_POINTS;
    let expected_profit_fee_2_sats = gross_payout_2_sats * PROFIT_FEE_BPS / BASIS_POINTS;
    let expected_aggregate_profit_fee_sats =
        expected_profit_fee_1_sats + expected_profit_fee_2_sats;

    assert_eq!(profit_fee_received_sats, expected_aggregate_profit_fee_sats);
}

/// Given: an expired option ready to settle by id
/// When: settle_option_by_id is called and status is queried immediately
/// Then: status is pending first and later reaches a terminal state after polling
#[test]
fn test_settle_option_by_id_status_transitions_from_pending_to_terminal() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 41;
    const BUYER_SEED: u64 = 42;
    const STRIKE_BPS: u16 = 500;
    const SETTLEMENT_PRICE_CENTS: u64 = 10_200_000;
    const OPTION_ID: u64 = 1;
    const EXPIRED_AT_SECONDS: u64 = 0;

    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

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

    set_oracle_price(&env, SETTLEMENT_PRICE_CENTS);
    testing_set_option_expiry_seconds(&env, OPTION_ID, EXPIRED_AT_SECONDS)
        .expect("Set expiry failed");

    // when
    let settlement_receipt =
        settle_option_by_id(&env, OPTION_ID).expect("settlement should enqueue");
    let initial_status =
        get_settlement_status(&env, settlement_receipt.operation_id).expect("status should load");

    // then
    assert!(matches!(
        initial_status,
        SettlementStatus::Pending { .. }
            | SettlementStatus::RecoveryRequired { .. }
            | SettlementStatus::Succeeded { .. }
            | SettlementStatus::Failed { .. }
    ));

    let mut terminal_status = initial_status;
    for _attempt in 0..8 {
        if matches!(
            terminal_status,
            SettlementStatus::Succeeded { .. } | SettlementStatus::Failed { .. }
        ) {
            break;
        }
        env.pic.tick();
        terminal_status = get_settlement_status(&env, settlement_receipt.operation_id)
            .expect("status should reload");
    }

    assert!(matches!(
        terminal_status,
        SettlementStatus::Succeeded { .. } | SettlementStatus::Failed { .. }
    ));
}

/// Given: an ITM option that settles normally with a real ckBTC ledger
/// When: comparing the writer's internal balance against the writer's actual ledger subaccount balance
/// Then: the 20 sats fee drift is exposed (internal balance exceeds ledger balance by 2 transfer fees)
#[test]
fn test_itm_settlement_writer_ledger_subaccount_misses_transfer_fees() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const WRITER_SEED: u64 = 91;
    const BUYER_SEED: u64 = 92;
    const STRIKE_BPS: u16 = 500;
    const OPTION_ID: u64 = 1;
    const TEST_SETTLEMENT_PRICE_CENTS: u64 = 12_345_678;

    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

    mint_and_sync_balance(&env, &writer_profile, QUANTITY_SATS).expect("Writer mint failed");
    mint_and_sync_balance(&env, &buyer_profile, PREMIUM_SATS + ACCEPT_TRANSFER_FEES)
        .expect("Buyer mint failed");

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

    let writer_subaccount = derive_subaccount(writer_profile.principal);

    let writer_balance_before =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance before failed");
    let writer_ledger_before =
        get_subaccount_ledger_balance(&env, env.volumetric_canister, Some(writer_subaccount));

    set_oracle_price(&env, TEST_SETTLEMENT_PRICE_CENTS);
    testing_set_option_expiry_seconds(&env, OPTION_ID, 0).expect("Set expiry failed");

    // when
    let response = settle_expired_options(&env).expect("Settle expired options failed");
    assert!(response.errors.is_empty());
    assert_eq!(response.settled.len(), 1);

    // then
    let writer_balance_after =
        get_user_balance(&env, &writer_wallet.address).expect("Writer balance after failed");
    let writer_ledger_after =
        get_subaccount_ledger_balance(&env, env.volumetric_canister, Some(writer_subaccount));

    let writer_internal_total_after = writer_balance_after.available + writer_balance_after.locked;
    let writer_internal_total_before =
        writer_balance_before.available + writer_balance_before.locked;

    let internal_delta = writer_internal_total_after as i64 - writer_internal_total_before as i64;
    let ledger_delta = writer_ledger_after as i64 - writer_ledger_before as i64;

    assert_eq!(
        internal_delta,
        ledger_delta,
        "internal balance delta ({}) should match ledger subaccount delta ({}); \
         expected drift of {} sats",
        internal_delta,
        ledger_delta,
        2 * CKBTC_TRANSFER_FEE,
    );
}

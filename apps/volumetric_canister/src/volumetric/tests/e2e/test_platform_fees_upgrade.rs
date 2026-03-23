use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    accept_offers, configure_test_ledger, create_account, create_offer,
    get_fee_recipient_ledger_balance, get_platform_fees_collected_total, mint_and_sync_balance,
    set_oracle_price, whitelist_controller,
};
use volumetric::AcceptOfferItem;

const FIRST_OFFER_ID: u64 = 1;
const ONE_DAY_SECS: u64 = 86_400;
const ENTRY_PRICE_CENTS: u64 = 10_000_000;
const ACCEPT_TRANSFER_COUNT: u64 = 2;
const CKBTC_TRANSFER_FEE: u64 = 10;
const ACCEPT_TRANSFER_FEES_SATS: u64 = ACCEPT_TRANSFER_COUNT * CKBTC_TRANSFER_FEE;
const QUANTITY_SATS: u64 = 100_000_000;
const PREMIUM_BASIS_POINTS: u16 = 100;
const BASIS_POINTS_DENOMINATOR: u64 = 10_000;
const BUYER_SEED: u64 = 21;
const WRITER_SEED: u64 = 22;
const STRIKE_BASIS_POINTS: u16 = 500;

/// Given: an accepted offer that collects platform premium fees
/// When: upgrading the canister
/// Then: get_platform_fees_collected_total remains unchanged after upgrade
#[test]
fn test_platform_fees_collected_total_survives_upgrade() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

    let premium_sats = QUANTITY_SATS * PREMIUM_BASIS_POINTS as u64 / BASIS_POINTS_DENOMINATOR;
    let buyer_required_sats = premium_sats + ACCEPT_TRANSFER_FEES_SATS;

    mint_and_sync_balance(&env, &writer_profile, QUANTITY_SATS).expect("Writer balance failed");
    mint_and_sync_balance(&env, &buyer_profile, buyer_required_sats).expect("Buyer balance failed");
    set_oracle_price(&env, ENTRY_PRICE_CENTS);

    create_offer(
        &env,
        &writer_wallet,
        QUANTITY_SATS,
        STRIKE_BASIS_POINTS,
        PREMIUM_BASIS_POINTS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    let fee_recipient_balance_before = get_fee_recipient_ledger_balance(&env);
    let metric_before = get_platform_fees_collected_total(&env);

    // when
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
    let metric_after_accept = get_platform_fees_collected_total(&env);

    env.upgrade_volumetric_canister();
    let metric_after_upgrade = get_platform_fees_collected_total(&env);

    // then
    let ledger_fee_delta_sats = fee_recipient_balance_after_accept - fee_recipient_balance_before;
    let metric_delta_sats = metric_after_accept - metric_before;
    assert!(metric_after_accept > metric_before);
    assert_eq!(metric_delta_sats, ledger_fee_delta_sats);
    assert_eq!(metric_after_upgrade, metric_after_accept);
}

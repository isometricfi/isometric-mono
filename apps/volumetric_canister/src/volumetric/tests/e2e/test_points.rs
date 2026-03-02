use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    accept_offers, configure_test_ledger, create_account, create_account_with_invite, create_offer,
    get_invite_code, get_points, get_points_config, get_referral_count, resolve_invite_code,
    set_oracle_price, set_points_config, settle_option_by_id, testing_set_option_expiry,
    whitelist_controller,
};
use volumetric::{errors::error_codes, AcceptOfferItem, PointsConfig, ProfileInfo};

const ORACLE_PRICE_CENTS: u64 = 10_000_000;
const STRIKE_BPS: u16 = 500;
const PREMIUM_BPS: u16 = 100;
const ONE_DAY_SECS: u64 = 86_400;
const BASIS_POINTS: u64 = 10_000;
const CKBTC_TRANSFER_FEE: u64 = 10;

fn setup_trade_for_accept(
    env: &crate::common::TestEnv,
    writer_wallet: &crate::common::TestWallet,
    buyer_wallet: &crate::common::TestWallet,
    writer_profile: &ProfileInfo,
    buyer_profile: &ProfileInfo,
) -> u64 {
    const QUANTITY_SATS: u64 = 10_000_000;
    const ACCEPT_TRANSFER_COUNT: u64 = 2;
    const OFFER_ID: u64 = 1;

    let premium_sats = QUANTITY_SATS * PREMIUM_BPS as u64 / BASIS_POINTS;
    let transfer_fees = ACCEPT_TRANSFER_COUNT * CKBTC_TRANSFER_FEE;

    crate::helpers::mint_and_sync_balance(env, &writer_profile, QUANTITY_SATS)
        .expect("Writer balance failed");
    crate::helpers::mint_and_sync_balance(env, &buyer_profile, premium_sats + transfer_fees)
        .expect("Buyer balance failed");

    create_offer(
        env,
        writer_wallet,
        QUANTITY_SATS,
        STRIKE_BPS,
        PREMIUM_BPS,
        ONE_DAY_SECS,
    )
    .expect("Create offer failed");

    let response = accept_offers(
        env,
        buyer_wallet,
        vec![AcceptOfferItem {
            offer_id: OFFER_ID,
            quantity: QUANTITY_SATS,
        }],
    )
    .expect("Accept offer failed");

    response
        .active_options
        .first()
        .map(|option| option.id)
        .expect("Expected at least one active option")
}

/// Given: a newly registered account
/// When: reading its invite code and resolving it back
/// Then: code is short and resolves to the same wallet address
#[test]
fn test_invite_code_generation_and_resolution_are_consistent() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);

    const USER_SEED: u64 = 101;
    let user_wallet = generate_wallet(USER_SEED);
    let profile = create_account(&env, &user_wallet).expect("Account creation failed");

    // when
    let invite_code = get_invite_code(&env, &user_wallet.address).expect("Invite code missing");
    let resolved_address =
        resolve_invite_code(&env, &invite_code).expect("Invite code should resolve");

    // then
    const EXPECTED_INVITE_CODE_LENGTH: usize = 6;
    assert_eq!(invite_code.len(), EXPECTED_INVITE_CODE_LENGTH);
    assert_eq!(resolved_address, profile.address);
}

/// Given: two referrers and one referred user account
/// When: referred user signs up with the first code, then attempts duplicate signup with second code
/// Then: first referrer keeps referral rewards and second referrer gets none
#[test]
fn test_referral_linking_is_one_time_and_referral_bonus_is_five_percent() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);
    set_oracle_price(&env, ORACLE_PRICE_CENTS);

    const REFERRER_ONE_SEED: u64 = 111;
    const REFERRER_TWO_SEED: u64 = 112;
    const REFERRED_SEED: u64 = 113;
    const WRITER_SEED: u64 = 114;

    let referrer_one_wallet = generate_wallet(REFERRER_ONE_SEED);
    let referrer_two_wallet = generate_wallet(REFERRER_TWO_SEED);
    let referred_wallet = generate_wallet(REFERRED_SEED);
    let writer_wallet = generate_wallet(WRITER_SEED);

    create_account(&env, &referrer_one_wallet).expect("Referrer one account failed");
    create_account(&env, &referrer_two_wallet).expect("Referrer two account failed");
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");

    let referrer_one_code = get_invite_code(&env, &referrer_one_wallet.address).expect("Code one");
    let referrer_two_code = get_invite_code(&env, &referrer_two_wallet.address).expect("Code two");

    let referred_profile =
        create_account_with_invite(&env, &referred_wallet, Some(referrer_one_code))
            .expect("Referred account creation failed");

    // when
    let duplicate_registration =
        create_account_with_invite(&env, &referred_wallet, Some(referrer_two_code));

    setup_trade_for_accept(
        &env,
        &writer_wallet,
        &referred_wallet,
        &writer_profile,
        &referred_profile,
    );

    let referrer_one_points = get_points(&env, &referrer_one_wallet.address).expect("Points one");
    let referrer_two_points = get_points(&env, &referrer_two_wallet.address).expect("Points two");
    let referred_points = get_points(&env, &referred_wallet.address).expect("Points referred");
    let referrer_one_referrals =
        get_referral_count(&env, &referrer_one_wallet.address).expect("Referrals one");
    let referrer_two_referrals =
        get_referral_count(&env, &referrer_two_wallet.address).expect("Referrals two");

    // then
    let duplicate_error = duplicate_registration.expect_err("Duplicate create should fail");
    assert_eq!(
        duplicate_error.code,
        error_codes::PROFILE_ALREADY_REGISTERED.code
    );

    const EXPECTED_REFERRED_POINTS: u64 = 100;
    const EXPECTED_REFERRAL_POINTS: u64 = 5;
    const EXPECTED_NO_POINTS: u64 = 0;
    const EXPECTED_ONE_REFERRAL: u64 = 1;

    assert_eq!(referred_points.total_points, EXPECTED_REFERRED_POINTS);
    assert_eq!(
        referrer_one_points.points_from_referrals,
        EXPECTED_REFERRAL_POINTS
    );
    assert_eq!(referrer_one_points.total_points, EXPECTED_REFERRAL_POINTS);
    assert_eq!(referrer_two_points.total_points, EXPECTED_NO_POINTS);
    assert_eq!(referrer_one_referrals, EXPECTED_ONE_REFERRAL);
    assert_eq!(referrer_two_referrals, EXPECTED_NO_POINTS);
}

/// Given: points and referral add-on is enabled
/// When: buyer accepts a valid offer
/// Then: core accept flow succeeds and points are awarded without blocking execution
#[test]
fn test_points_add_on_does_not_block_core_accept_flow() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);
    set_oracle_price(&env, ORACLE_PRICE_CENTS);

    const WRITER_SEED: u64 = 121;
    const BUYER_SEED: u64 = 122;
    let writer_wallet = generate_wallet(WRITER_SEED);
    let buyer_wallet = generate_wallet(BUYER_SEED);
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let buyer_profile = create_account(&env, &buyer_wallet).expect("Buyer account failed");

    // when
    setup_trade_for_accept(
        &env,
        &writer_wallet,
        &buyer_wallet,
        &writer_profile,
        &buyer_profile,
    );
    let writer_points = get_points(&env, &writer_wallet.address).expect("Writer points missing");
    let buyer_points = get_points(&env, &buyer_wallet.address).expect("Buyer points missing");

    // then
    const EXPECTED_BASE_POINTS: u64 = 100;
    assert_eq!(writer_points.total_points, EXPECTED_BASE_POINTS);
    assert_eq!(buyer_points.total_points, EXPECTED_BASE_POINTS);
}

/// Given: admin updates points configuration
/// When: a referred buyer accepts and wins an option
/// Then: awarded points and referral bonus use the updated runtime values
#[test]
fn test_admin_can_update_points_config_and_awards_use_latest_values() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);
    set_oracle_price(&env, ORACLE_PRICE_CENTS);

    const REFERRER_SEED: u64 = 131;
    const REFERRED_BUYER_SEED: u64 = 132;
    const WRITER_SEED: u64 = 133;
    let referrer_wallet = generate_wallet(REFERRER_SEED);
    let buyer_wallet = generate_wallet(REFERRED_BUYER_SEED);
    let writer_wallet = generate_wallet(WRITER_SEED);

    const CUSTOM_REFERRAL_BPS: u64 = 1_000;
    const CUSTOM_BUYER_ACCEPT_POINTS: u64 = 210;
    const CUSTOM_WRITER_ACCEPT_POINTS: u64 = 330;
    const CUSTOM_BUYER_WIN_BONUS: u64 = 70;
    let points_config = PointsConfig {
        referral_basis_points: CUSTOM_REFERRAL_BPS,
        offer_accepted_buyer_points: CUSTOM_BUYER_ACCEPT_POINTS,
        offer_accepted_writer_points: CUSTOM_WRITER_ACCEPT_POINTS,
        buyer_win_bonus_points: CUSTOM_BUYER_WIN_BONUS,
    };
    set_points_config(&env, points_config);
    let stored_points_config = get_points_config(&env);
    assert_eq!(
        stored_points_config.offer_accepted_buyer_points,
        CUSTOM_BUYER_ACCEPT_POINTS
    );
    assert_eq!(
        stored_points_config.offer_accepted_writer_points,
        CUSTOM_WRITER_ACCEPT_POINTS
    );
    assert_eq!(
        stored_points_config.buyer_win_bonus_points,
        CUSTOM_BUYER_WIN_BONUS
    );
    assert_eq!(
        stored_points_config.referral_basis_points,
        CUSTOM_REFERRAL_BPS
    );

    create_account(&env, &referrer_wallet).expect("Referrer account failed");
    let writer_profile = create_account(&env, &writer_wallet).expect("Writer account failed");
    let referrer_code = get_invite_code(&env, &referrer_wallet.address).expect("Referrer code");
    let buyer_profile = create_account_with_invite(&env, &buyer_wallet, Some(referrer_code))
        .expect("Buyer account with invite failed");

    // when
    let option_id = setup_trade_for_accept(
        &env,
        &writer_wallet,
        &buyer_wallet,
        &writer_profile,
        &buyer_profile,
    );
    const ITM_SETTLEMENT_PRICE_CENTS: u64 = 11_000_000;
    set_oracle_price(&env, ITM_SETTLEMENT_PRICE_CENTS);
    testing_set_option_expiry(&env, option_id, 0).expect("Set option expiry failed");
    settle_option_by_id(&env, option_id).expect("Settle option failed");

    let referrer_points = get_points(&env, &referrer_wallet.address).expect("Referrer points");
    let buyer_points = get_points(&env, &buyer_wallet.address).expect("Buyer points");
    let writer_points = get_points(&env, &writer_wallet.address).expect("Writer points");

    // then
    const BASIS_POINTS_DENOMINATOR: u64 = 10_000;
    let expected_referral_from_accept =
        (CUSTOM_BUYER_ACCEPT_POINTS * CUSTOM_REFERRAL_BPS) / BASIS_POINTS_DENOMINATOR;
    let expected_referral_from_win =
        (CUSTOM_BUYER_WIN_BONUS * CUSTOM_REFERRAL_BPS) / BASIS_POINTS_DENOMINATOR;
    let expected_referral_total = expected_referral_from_accept + expected_referral_from_win;
    let expected_buyer_total = CUSTOM_BUYER_ACCEPT_POINTS + CUSTOM_BUYER_WIN_BONUS;

    assert_eq!(buyer_points.total_points, expected_buyer_total);
    assert_eq!(
        buyer_points.points_from_offer_accepted_buyer,
        CUSTOM_BUYER_ACCEPT_POINTS
    );
    assert_eq!(
        buyer_points.points_from_buyer_win_bonus,
        CUSTOM_BUYER_WIN_BONUS
    );

    assert_eq!(writer_points.total_points, CUSTOM_WRITER_ACCEPT_POINTS);
    assert_eq!(
        writer_points.points_from_offer_accepted_writer,
        CUSTOM_WRITER_ACCEPT_POINTS
    );

    assert_eq!(referrer_points.total_points, expected_referral_total);
    assert_eq!(
        referrer_points.points_from_referrals,
        expected_referral_total
    );
}

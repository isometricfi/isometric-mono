use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    create_account, create_account_with_invite, get_account_info, resolve_invite_code,
    whitelist_controller,
};

/// Given: a newly registered account
/// When: reading its invite code and resolving it back
/// Then: the code resolves to the same wallet address
#[test]
fn test_invite_code_generation_and_resolution_are_consistent() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);

    const USER_SEED: u64 = 101;
    let user_wallet = generate_wallet(USER_SEED);
    let profile = create_account(&env, &user_wallet).expect("Account creation failed");

    // when
    let account_info = get_account_info(&env, &user_wallet.address).expect("Account info missing");
    let invite_code = account_info.invite_code.expect("Invite code missing");
    let resolved_address =
        resolve_invite_code(&env, &invite_code).expect("Invite code should resolve");

    // then
    const EXPECTED_INVITE_CODE_LENGTH: usize = 6;
    assert_eq!(invite_code.len(), EXPECTED_INVITE_CODE_LENGTH);
    assert_eq!(resolved_address, profile.address);
    assert_eq!(account_info.referral_count, 0);
}

/// Given: a valid referrer invite code
/// When: a new account signs up with that code
/// Then: the referrer referral count increases by one
#[test]
fn test_valid_invite_code_increments_referral_count() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);

    const REFERRER_SEED: u64 = 102;
    const REFERRED_SEED: u64 = 103;
    let referrer_wallet = generate_wallet(REFERRER_SEED);
    let referred_wallet = generate_wallet(REFERRED_SEED);
    create_account(&env, &referrer_wallet).expect("Referrer account creation failed");
    let referrer_info =
        get_account_info(&env, &referrer_wallet.address).expect("Referrer account info missing");
    let invite_code = referrer_info
        .invite_code
        .expect("Referrer invite code missing");

    // when
    create_account_with_invite(&env, &referred_wallet, Some(invite_code))
        .expect("Referred account creation failed");
    let updated_referrer_info =
        get_account_info(&env, &referrer_wallet.address).expect("Updated referrer info missing");

    // then
    const EXPECTED_REFERRAL_COUNT: u64 = 1;
    assert_eq!(
        updated_referrer_info.referral_count,
        EXPECTED_REFERRAL_COUNT
    );
}

/// Given: an invalid invite code
/// When: a new account signs up with that code
/// Then: the account is created and no referral is counted
#[test]
fn test_invalid_invite_code_is_ignored() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);

    const REFERRER_SEED: u64 = 104;
    const REFERRED_SEED: u64 = 105;
    let referrer_wallet = generate_wallet(REFERRER_SEED);
    let referred_wallet = generate_wallet(REFERRED_SEED);
    create_account(&env, &referrer_wallet).expect("Referrer account creation failed");

    // when
    create_account_with_invite(&env, &referred_wallet, Some("bad-code".to_string()))
        .expect("Account creation should still succeed");
    let referrer_info =
        get_account_info(&env, &referrer_wallet.address).expect("Referrer account info missing");

    // then
    assert_eq!(referrer_info.referral_count, 0);
}

use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    create_account, create_account_with_invite, get_account_info, resolve_invite_code,
    validate_invite_code, whitelist_controller,
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
    let account_info =
        get_account_info(&env, &user_wallet.address, true).expect("Account info missing");
    let invite_code = account_info.invite_code.expect("Invite code missing");
    let resolved_address =
        resolve_invite_code(&env, &invite_code).expect("Invite code should resolve");

    // then
    const EXPECTED_INVITE_CODE_LENGTH: usize = 6;
    assert_eq!(invite_code.len(), EXPECTED_INVITE_CODE_LENGTH);
    assert_eq!(resolved_address, profile.address);
    assert_eq!(account_info.referral_count, Some(0));
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
    let referrer_info = get_account_info(&env, &referrer_wallet.address, true)
        .expect("Referrer account info missing");
    let invite_code = referrer_info
        .invite_code
        .expect("Referrer invite code missing");

    // when
    create_account_with_invite(&env, &referred_wallet, Some(invite_code))
        .expect("Referred account creation failed");
    let updated_referrer_info = get_account_info(&env, &referrer_wallet.address, true)
        .expect("Updated referrer info missing");

    // then
    const EXPECTED_REFERRAL_COUNT: Option<u64> = Some(1);
    assert_eq!(
        updated_referrer_info.referral_count,
        EXPECTED_REFERRAL_COUNT
    );
}

/// Given: a valid referrer invite code
/// When: validating it for a different wallet address
/// Then: the canister returns true without requiring a signature
#[test]
fn test_validate_invite_code_returns_true_for_valid_referral() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);

    const REFERRER_SEED: u64 = 106;
    const REFERRED_SEED: u64 = 107;
    let referrer_wallet = generate_wallet(REFERRER_SEED);
    let referred_wallet = generate_wallet(REFERRED_SEED);
    create_account(&env, &referrer_wallet).expect("Referrer account creation failed");
    let referrer_info = get_account_info(&env, &referrer_wallet.address, true)
        .expect("Referrer account info missing");
    let invite_code = referrer_info
        .invite_code
        .expect("Referrer invite code missing");

    // when
    let is_valid = validate_invite_code(&env, &invite_code, &referred_wallet.address);

    // then
    assert!(is_valid);
}

/// Given: an invalid invite code
/// When: a new account signs up with that code
/// Then: account creation fails and the referred account is not persisted
#[test]
fn test_invalid_invite_code_rejects_account_creation() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);

    const REFERRER_SEED: u64 = 104;
    const REFERRED_SEED: u64 = 105;
    let referrer_wallet = generate_wallet(REFERRER_SEED);
    let referred_wallet = generate_wallet(REFERRED_SEED);
    create_account(&env, &referrer_wallet).expect("Referrer account creation failed");

    // when
    let result = create_account_with_invite(&env, &referred_wallet, Some("bad-code".to_string()));
    let referrer_info = get_account_info(&env, &referrer_wallet.address, true)
        .expect("Referrer account info missing");
    let referred_account_info = get_account_info(&env, &referred_wallet.address, true);

    // then
    let error = result.expect_err("Account creation should fail for an invalid invite code");
    assert_eq!(error.name, "INVALID_INVITE_CODE");
    assert_eq!(referrer_info.referral_count, Some(0));
    assert!(referred_account_info.is_none());
}

/// Given: a user validates their own invite code
/// When: the query checks that invite against their address
/// Then: the code is rejected before signing
#[test]
fn test_validate_invite_code_returns_false_for_self_referral() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);

    const USER_SEED: u64 = 108;
    let user_wallet = generate_wallet(USER_SEED);
    create_account(&env, &user_wallet).expect("User account creation failed");
    let account_info =
        get_account_info(&env, &user_wallet.address, true).expect("Account info missing");
    let invite_code = account_info.invite_code.expect("Invite code missing");

    // when
    let is_valid = validate_invite_code(&env, &invite_code, &user_wallet.address);

    // then
    assert!(!is_valid);
}

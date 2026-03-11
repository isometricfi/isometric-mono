use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{create_account, get_invite_code, resolve_invite_code, whitelist_controller};

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
    let invite_code = get_invite_code(&env, &user_wallet.address).expect("Invite code missing");
    let resolved_address =
        resolve_invite_code(&env, &invite_code).expect("Invite code should resolve");

    // then
    const EXPECTED_INVITE_CODE_LENGTH: usize = 6;
    assert_eq!(invite_code.len(), EXPECTED_INVITE_CODE_LENGTH);
    assert_eq!(resolved_address, profile.address);
}

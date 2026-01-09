use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{create_account, whitelist_controller};

/// Given: Valid Bitcoin wallet with signing capability
/// When: User registers with Bitcoin signature
/// Then: Profile created with matching address, no username
#[test]
fn test_register_account_with_bitcoin_signature_creates_profile() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);

    const WALLET_SEED: u64 = 1;
    let wallet = generate_wallet(WALLET_SEED);

    // when
    let result = create_account(&env, &wallet);

    // then
    let profile = result.expect("Account creation failed");
    assert_eq!(profile.address, wallet.address);
    assert!(profile.username.is_none());
}

use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{create_account, get_events_for_principal, whitelist_controller};
use volumetric::{EventData, EventType};

/// Given: Valid Bitcoin wallet with signing capability
/// When: User registers with Bitcoin signature
/// Then: Profile created with matching address, no username, AccountCreated event emitted
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

    let events = get_events_for_principal(&env, profile.principal);
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].event_type, EventType::AccountCreated);
    assert_eq!(
        events[0].data,
        EventData::AccountCreated {
            wallet_address: wallet.address.clone(),
        }
    );
}

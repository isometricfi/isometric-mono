#[path = "common/mod.rs"]
mod common;

use common::{create_test_env, fixtures, generate_wallet, ledger, minter};
use icrc_ledger_types::icrc1::account::Account;

const MINT_AMOUNT: u64 = 1_000;
const UTXO_VALUE_SATS: u64 = 100_000;
const UTXO_HEIGHT: u32 = 42;

#[test]
fn test_environment_creates_all_canisters() {
    // given/when
    let env = create_test_env();

    // then
    assert!(!env.volumetric_canister.to_string().is_empty());
    assert!(!env.ledger_canister.to_string().is_empty());
    assert!(!env.minter_canister.to_string().is_empty());
}

#[test]
fn test_wallet_generates_testnet_address() {
    // given
    let seed = 1;

    // when
    let wallet = generate_wallet(seed);

    // then
    assert!(wallet.address.starts_with("tb1"));
    assert!(wallet.address.len() > 10);
}

#[test]
fn test_ledger_mint_increases_balance() {
    // given
    let env = create_test_env();
    let test_principal = fixtures::test_principal(1);
    let account = Account {
        owner: test_principal,
        subaccount: None,
    };

    let initial_balance = ledger::balance_of(&env, account);
    assert_eq!(initial_balance, 0);

    // when
    ledger::mint(&env, account, MINT_AMOUNT).expect("Failed to mint tokens");

    // then
    let new_balance = ledger::balance_of(&env, account);
    assert_eq!(new_balance, MINT_AMOUNT);
}

#[test]
fn test_mock_utxo_creation() {
    // given
    minter::init();

    // when
    let utxo = minter::create_utxo(UTXO_VALUE_SATS, UTXO_HEIGHT);

    // then
    assert_eq!(utxo.value, UTXO_VALUE_SATS);
    assert_eq!(utxo.height, UTXO_HEIGHT);
    assert!(!utxo.outpoint.txid.is_empty());

    minter::clear();
}

#[test]
fn test_fixtures_generate_correct_counts() {
    // given
    let principal_count = 3;
    let utxo_values = vec![1000, 2000, 3000];

    // when
    let principals = fixtures::test_principals(principal_count);
    let utxos = fixtures::mock_utxos(utxo_values.clone());

    // then
    assert_eq!(principals.len(), principal_count);
    assert_eq!(utxos.len(), utxo_values.len());
    assert_eq!(utxos[0].value, utxo_values[0]);
    assert_eq!(utxos[1].value, utxo_values[1]);
    assert_eq!(utxos[2].value, utxo_values[2]);
}

#[test]
fn test_btc_address_generation_is_deterministic() {
    // given
    minter::init();
    let principal = fixtures::test_principal(1);

    // when
    let address1 = minter::get_btc_address(principal, None);
    let address2 = minter::get_btc_address(principal, None);

    // then
    assert!(address1.starts_with("tb1q"));
    assert_eq!(address1, address2);

    minter::clear();
}

#[path = "common/mod.rs"]
mod common;

use common::{create_test_env, fixtures, generate_wallet, ledger, minter};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferError;

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
fn test_ledger_deduplicates_identical_transfer_payload_but_not_different_memo() {
    // given
    let env = create_test_env();
    let sender = fixtures::test_principal(10);
    let recipient = fixtures::test_principal(11);
    let sender_account = Account {
        owner: sender,
        subaccount: None,
    };
    let recipient_account = Account {
        owner: recipient,
        subaccount: None,
    };
    const INITIAL_SENDER_BALANCE_SATS: u64 = 10_000;
    const TRANSFER_AMOUNT_SATS: u64 = 1_000;
    let created_at_time_ns = env.get_time_ns();
    let first_memo_bytes = b"dedup-transfer-1".to_vec();
    let second_memo_bytes = b"dedup-transfer-2".to_vec();

    ledger::mint(&env, sender_account, INITIAL_SENDER_BALANCE_SATS)
        .expect("mint should fund sender");

    // when
    let first_transfer_result = ledger::transfer_with_dedup_fields(
        &env,
        sender,
        recipient_account,
        TRANSFER_AMOUNT_SATS,
        None,
        Some(first_memo_bytes.clone()),
        Some(created_at_time_ns),
    );
    let duplicate_transfer_result = ledger::transfer_with_dedup_fields(
        &env,
        sender,
        recipient_account,
        TRANSFER_AMOUNT_SATS,
        None,
        Some(first_memo_bytes),
        Some(created_at_time_ns),
    );
    let different_memo_transfer_result = ledger::transfer_with_dedup_fields(
        &env,
        sender,
        recipient_account,
        TRANSFER_AMOUNT_SATS,
        None,
        Some(second_memo_bytes),
        Some(created_at_time_ns),
    );

    // then
    let first_transfer_block_index = first_transfer_result.expect("first transfer should succeed");
    match duplicate_transfer_result {
        Err(TransferError::Duplicate { duplicate_of }) => {
            let duplicate_block_index = duplicate_of.0.try_into().unwrap_or(u64::MAX);
            assert_eq!(duplicate_block_index, first_transfer_block_index);
        }
        other => panic!("expected duplicate transfer error, got {:?}", other),
    }

    let different_memo_block_index =
        different_memo_transfer_result.expect("transfer with different memo should succeed");
    assert!(
        different_memo_block_index > first_transfer_block_index,
        "different memo should produce a new ledger block"
    );

    let recipient_balance = ledger::balance_of(&env, recipient_account);
    assert_eq!(recipient_balance, TRANSFER_AMOUNT_SATS * 2);
}

#[test]
fn test_ledger_deduplicates_identical_transfer_payload_without_memo() {
    // given
    let env = create_test_env();
    let sender = fixtures::test_principal(20);
    let recipient = fixtures::test_principal(21);
    let sender_account = Account {
        owner: sender,
        subaccount: None,
    };
    let recipient_account = Account {
        owner: recipient,
        subaccount: None,
    };
    const INITIAL_SENDER_BALANCE_SATS: u64 = 10_000;
    const TRANSFER_AMOUNT_SATS: u64 = 1_000;
    let created_at_time_ns = env.get_time_ns();

    ledger::mint(&env, sender_account, INITIAL_SENDER_BALANCE_SATS)
        .expect("mint should fund sender");

    // when
    let first_transfer_result = ledger::transfer_with_dedup_fields(
        &env,
        sender,
        recipient_account,
        TRANSFER_AMOUNT_SATS,
        None,
        None,
        Some(created_at_time_ns),
    );
    let duplicate_transfer_result = ledger::transfer_with_dedup_fields(
        &env,
        sender,
        recipient_account,
        TRANSFER_AMOUNT_SATS,
        None,
        None,
        Some(created_at_time_ns),
    );

    // then
    let first_transfer_block_index =
        first_transfer_result.expect("first transfer without memo should succeed");
    match duplicate_transfer_result {
        Err(TransferError::Duplicate { duplicate_of }) => {
            let duplicate_block_index = duplicate_of.0.try_into().unwrap_or(u64::MAX);
            assert_eq!(duplicate_block_index, first_transfer_block_index);
        }
        other => panic!("expected duplicate transfer error, got {:?}", other),
    }

    let recipient_balance = ledger::balance_of(&env, recipient_account);
    assert_eq!(recipient_balance, TRANSFER_AMOUNT_SATS);
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

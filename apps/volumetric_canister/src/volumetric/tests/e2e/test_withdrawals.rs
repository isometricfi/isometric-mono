use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    configure_test_ledger, create_account, get_user_balance, get_withdraw_status,
    mint_and_sync_balance, whitelist_controller, withdraw_ckbtc,
};
use volumetric::errors::error_codes;
use volumetric::{WithdrawStatus, WithdrawalPhase};

const WITHDRAW_AMOUNT_SATS: u64 = 100_000;
const INITIAL_BALANCE_SATS: u64 = 500_000;
const TEST_BTC_ADDRESS: &str = "tb1qvolumetricwithdraw";

/// Given: a funded account with a valid withdrawal request
/// When: withdraw_ckbtc is called
/// Then: a receipt is returned immediately and status is pending
#[test]
fn test_withdraw_returns_receipt_and_initial_pending_status() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const USER_SEED: u64 = 21;
    let wallet = generate_wallet(USER_SEED);
    let profile = create_account(&env, &wallet).expect("Create account failed");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("Funding failed");

    // when
    let receipt = withdraw_ckbtc(&env, &wallet, TEST_BTC_ADDRESS, WITHDRAW_AMOUNT_SATS)
        .expect("withdraw should enqueue");
    let status =
        get_withdraw_status(&env, receipt.operation_id).expect("status should load after enqueue");

    // then
    assert!(receipt.withdrawal_id > 0);
    match status {
        WithdrawStatus::Pending {
            receipt: status_receipt,
            phase,
            last_error,
        } => {
            assert_eq!(status_receipt, receipt);
            assert!(matches!(
                phase,
                WithdrawalPhase::Started
                    | WithdrawalPhase::Approved
                    | WithdrawalPhase::RetrieveRequested { .. }
            ));
            assert!(
                last_error.is_none()
                    || last_error.is_some_and(|message| !message.trim().is_empty())
            );
        }
        other => panic!("expected pending withdraw status, got {:?}", other),
    }
}

/// Given: minter calls fail with retryable inter-canister errors in e2e
/// When: withdrawal status is queried after retry nudges
/// Then: status remains pending and records the latest retryable error
#[test]
fn test_withdraw_retryable_failure_keeps_pending_with_last_error() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const USER_SEED: u64 = 22;
    let wallet = generate_wallet(USER_SEED);
    let profile = create_account(&env, &wallet).expect("Create account failed");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("Funding failed");

    let receipt = withdraw_ckbtc(&env, &wallet, TEST_BTC_ADDRESS, WITHDRAW_AMOUNT_SATS)
        .expect("withdraw should enqueue");

    // when
    env.advance_time_secs(3_600);
    let status =
        get_withdraw_status(&env, receipt.operation_id).expect("status should load after retry");

    // then
    match status {
        WithdrawStatus::Pending {
            phase, last_error, ..
        } => {
            assert!(matches!(
                phase,
                WithdrawalPhase::Started | WithdrawalPhase::Approved
            ));
            assert!(last_error
                .as_ref()
                .is_some_and(|message| !message.trim().is_empty()));
        }
        other => panic!("expected pending withdraw status, got {:?}", other),
    }
}

/// Given: a queued withdrawal with retryable minter failures
/// When: status is polled over the helper retry window
/// Then: it remains pending with retry metadata and keeps the deducted amount reserved
#[test]
fn test_withdraw_retry_window_keeps_pending_and_balance_reserved() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const USER_SEED: u64 = 23;
    let wallet = generate_wallet(USER_SEED);
    let profile = create_account(&env, &wallet).expect("Create account failed");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("Funding failed");

    let balance_before_withdraw =
        get_user_balance(&env, &wallet.address).expect("initial balance lookup failed");

    let receipt = withdraw_ckbtc(&env, &wallet, TEST_BTC_ADDRESS, WITHDRAW_AMOUNT_SATS)
        .expect("withdraw should enqueue");

    // when
    for _ in 0..8 {
        env.advance_time_secs(3_600);
    }
    let latest_status =
        get_withdraw_status(&env, receipt.operation_id).expect("status should load after retries");

    // then
    match latest_status {
        WithdrawStatus::Pending {
            receipt: pending_receipt,
            last_error,
            ..
        } => {
            assert_eq!(pending_receipt.operation_id, receipt.operation_id);
            assert!(last_error
                .as_ref()
                .is_some_and(|message| !message.trim().is_empty()));
        }
        other => panic!("expected pending withdraw status, got {:?}", other),
    }

    let balance_after_terminal =
        get_user_balance(&env, &wallet.address).expect("final balance lookup failed");
    assert_eq!(
        balance_after_terminal.available,
        balance_before_withdraw
            .available
            .saturating_sub(WITHDRAW_AMOUNT_SATS)
    );
}

/// Given: a user already has a pending withdrawal
/// When: they submit another withdrawal request before completion
/// Then: the second request is rejected with WITHDRAWAL_IN_PROGRESS
#[test]
fn test_withdraw_rejects_second_request_while_first_is_pending() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    const USER_SEED: u64 = 24;
    let wallet = generate_wallet(USER_SEED);
    let profile = create_account(&env, &wallet).expect("Create account failed");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("Funding failed");

    // when
    let _first_receipt = withdraw_ckbtc(&env, &wallet, TEST_BTC_ADDRESS, WITHDRAW_AMOUNT_SATS)
        .expect("first withdraw should enqueue");
    let second_result = withdraw_ckbtc(&env, &wallet, TEST_BTC_ADDRESS, WITHDRAW_AMOUNT_SATS);

    // then
    let second_error = second_result.expect_err("second withdraw should be blocked");
    assert_eq!(second_error.code, error_codes::WITHDRAWAL_IN_PROGRESS.code);
}

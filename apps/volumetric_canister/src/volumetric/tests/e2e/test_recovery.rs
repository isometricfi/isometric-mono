use crate::common::{create_test_env, generate_wallet};
use crate::helpers::{
    configure_test_ledger, create_account, get_recovery_required_wal_entries, get_withdraw_status,
    mint_and_sync_balance, recover_wal_operation, whitelist_controller, withdraw_ckbtc,
};
use volumetric::{WalExecutionOutcome, WithdrawStatus};

const WITHDRAW_AMOUNT_SATS: u64 = 100_000;
const INITIAL_BALANCE_SATS: u64 = 500_000;

/// Given: a withdrawal enters recovery-required state after an ambiguous external failure
/// When: controller lists recovery-required WAL entries
/// Then: the operation id appears in the recovery-required list
#[test]
fn test_get_recovery_required_wal_entries_includes_withdraw_operation() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);
    let wallet = generate_wallet(31);
    let profile = create_account(&env, &wallet).expect("Create account failed");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("Funding failed");
    let receipt =
        withdraw_ckbtc(&env, &wallet, WITHDRAW_AMOUNT_SATS).expect("withdraw should enqueue");
    env.advance_time_secs(3_600);

    // when
    let recovery_required_operation_ids =
        get_recovery_required_wal_entries(&env, 100).expect("recovery query should succeed");

    // then
    assert!(recovery_required_operation_ids.contains(&receipt.operation_id));
}

/// Given: a recovery-required withdrawal operation
/// When: controller replays the operation manually through recovery endpoint
/// Then: WAL execution returns recovery-required again while external failure persists
#[test]
fn test_recover_wal_operation_replays_manual_recovery_attempt() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);
    let wallet = generate_wallet(32);
    let profile = create_account(&env, &wallet).expect("Create account failed");
    mint_and_sync_balance(&env, &profile, INITIAL_BALANCE_SATS).expect("Funding failed");
    let receipt =
        withdraw_ckbtc(&env, &wallet, WITHDRAW_AMOUNT_SATS).expect("withdraw should enqueue");
    env.advance_time_secs(3_600);

    // when
    let manual_recovery_outcome =
        recover_wal_operation(&env, receipt.operation_id).expect("manual recovery should execute");
    let status_after_manual_recovery =
        get_withdraw_status(&env, receipt.operation_id).expect("status should load");

    // then
    assert!(matches!(
        manual_recovery_outcome,
        WalExecutionOutcome::RecoveryRequired(_)
    ));
    assert!(matches!(
        status_after_manual_recovery,
        WithdrawStatus::RecoveryRequired { .. }
    ));
}

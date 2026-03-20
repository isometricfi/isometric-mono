use candid::{CandidType, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

use crate::auth::derive_subaccount;
use crate::errors::{error_codes, VolumetricError};
use crate::generated::ckbtc::RetrieveBtcWithApprovalArgs;
use crate::journaling::{
    default_policy, enqueue_if_absent, execute_wal_entry_now, get_entry, register_retryable_error,
    OperationId, WalExecutionError, WalExecutionOutcome, WalKind, WalPayload, WalResult,
    WithdrawalWalPayload,
};
use crate::locks::WithdrawalLock;
use crate::storage::{
    add_available, complete_withdrawal, create_withdrawal, emit_event,
    get_pending_withdrawals_by_principal, get_withdrawal, remove_withdrawal, subtract_available,
    update_withdrawal_phase, Config, EventData, EventType, WithdrawalPhase,
};
use crate::{ic, ledger, minter};

pub struct WithdrawParams {
    pub btc_address: String,
    pub amount: u64,
}

#[derive(Debug)]
pub struct WithdrawResult {
    pub block_index: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct WithdrawalWalResult {
    pub block_index: u64,
}

pub async fn withdraw_ckbtc_use_case(
    principal: Principal,
    params: WithdrawParams,
    request_nonce: u64,
) -> Result<WithdrawResult, VolumetricError> {
    // bind to _lock, not `let _ =` which drops immediately
    let _lock = WithdrawalLock::new(principal)?;

    if !get_pending_withdrawals_by_principal(principal).is_empty() {
        return Err(VolumetricError::from_def(
            error_codes::WITHDRAWAL_IN_PROGRESS,
            None,
            None,
        ));
    }

    let operation_id =
        withdrawal_operation_id(principal, &params.btc_address, params.amount, request_nonce);
    if let Some(existing_entry) = get_entry(operation_id) {
        return match existing_entry.result {
            Some(WalResult::Withdrawal(result)) => Ok(WithdrawResult {
                block_index: result.block_index,
            }),
            _ => Err(VolumetricError::from_def(
                error_codes::WITHDRAWAL_IN_PROGRESS,
                Some("withdrawal already scheduled"),
                None,
            )),
        };
    }

    subtract_available(principal, params.amount).map_err(|e| {
        VolumetricError::from_def(
            error_codes::INSUFFICIENT_BALANCE,
            Some(&format!(
                "available: {}, required: {}",
                e.available, e.required
            )),
            None,
        )
    })?;

    let created_at_time = ic::time();

    let withdrawal = create_withdrawal(
        principal,
        params.amount,
        params.btc_address.clone(),
        created_at_time,
    );
    let withdrawal_id = withdrawal.id;

    enqueue_if_absent(
        operation_id,
        WalKind::Withdrawal,
        WalPayload::Withdrawal(WithdrawalWalPayload {
            withdrawal_id,
            principal,
            amount_sats: params.amount,
            btc_address: params.btc_address,
            created_at_time_ns: created_at_time,
        }),
        default_policy(),
    );

    match execute_wal_entry_now(operation_id).await {
        WalExecutionOutcome::Succeeded | WalExecutionOutcome::SucceededAlready => {
            let wal_entry = get_entry(operation_id).ok_or_else(|| {
                VolumetricError::from_def(
                    error_codes::INTERNAL_ERROR,
                    Some("withdrawal completed without wal entry"),
                    None,
                )
            })?;

            let wal_result = wal_entry.result.ok_or_else(|| {
                VolumetricError::from_def(
                    error_codes::INTERNAL_ERROR,
                    Some("withdrawal completed without result"),
                    None,
                )
            })?;

            let withdrawal_wal_result = match wal_result {
                WalResult::Withdrawal(result) => result,
                _ => {
                    return Err(VolumetricError::from_def(
                        error_codes::INTERNAL_ERROR,
                        Some("withdrawal completed with unexpected wal result type"),
                        None,
                    ));
                }
            };

            Ok(WithdrawResult {
                block_index: withdrawal_wal_result.block_index,
            })
        }
        WalExecutionOutcome::SkippedAlreadyInFlight | WalExecutionOutcome::FailedRetryable(_) => {
            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("withdrawal queued for retry"),
                None,
            ))
        }
        WalExecutionOutcome::FailedPermanent(message) => {
            add_available(principal, params.amount);
            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&message),
                None,
            ))
        }
    }
}

pub async fn run_withdrawal_wal(
    payload: &WithdrawalWalPayload,
) -> Result<WithdrawalWalResult, WalExecutionError> {
    let withdrawal = get_withdrawal(payload.withdrawal_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "withdrawal journal {} not found",
            payload.withdrawal_id
        ))
    })?;

    let subaccount = derive_subaccount(payload.principal);
    let minter = Config::ckbtc_minter();

    if withdrawal.phase == WithdrawalPhase::Started {
        let approve_args = icrc_ledger_types::icrc2::approve::ApproveArgs {
            from_subaccount: Some(subaccount),
            spender: Account {
                owner: minter,
                subaccount: None,
            },
            amount: Nat::from(payload.amount_sats),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: Some(payload.created_at_time_ns),
        };

        ledger::icrc2_approve(approve_args)
            .await
            .map_err(map_withdrawal_approve_error)?;

        update_withdrawal_phase(payload.withdrawal_id, WithdrawalPhase::Approved);
    }

    let withdrawal = get_withdrawal(payload.withdrawal_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "withdrawal journal {} missing before retrieve",
            payload.withdrawal_id
        ))
    })?;

    if withdrawal.phase == WithdrawalPhase::Approved {
        let retrieve_args = RetrieveBtcWithApprovalArgs {
            address: payload.btc_address.clone(),
            amount: payload.amount_sats,
            from_subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
        };

        let retrieve_result = minter::retrieve_btc_with_approval(retrieve_args).await;
        let retrieve_ok = match retrieve_result {
            Ok(ok) => ok,
            Err(error) => return Err(map_withdrawal_error(error)),
        };

        update_withdrawal_phase(
            payload.withdrawal_id,
            WithdrawalPhase::RetrieveRequested {
                block_index: retrieve_ok.block_index,
            },
        );
        complete_withdrawal(payload.withdrawal_id, retrieve_ok.block_index);
        remove_withdrawal(payload.withdrawal_id);

        emit_event(
            payload.principal,
            EventType::Withdrawal,
            EventData::Withdrawal {
                amount_sats: payload.amount_sats,
                destination: payload.btc_address.clone(),
            },
        );

        return Ok(WithdrawalWalResult {
            block_index: retrieve_ok.block_index,
        });
    }

    match withdrawal.phase {
        WithdrawalPhase::RetrieveRequested { block_index }
        | WithdrawalPhase::Completed { block_index } => Ok(WithdrawalWalResult { block_index }),
        _ => Err(WalExecutionError::Permanent(format!(
            "withdrawal {} in unexpected phase {:?}",
            payload.withdrawal_id, withdrawal.phase
        ))),
    }
}

fn withdrawal_operation_id(
    principal: Principal,
    btc_address: &str,
    amount_sats: u64,
    request_nonce: u64,
) -> OperationId {
    let amount_bytes = amount_sats.to_be_bytes();
    let nonce_bytes = request_nonce.to_be_bytes();
    OperationId::from_principal_bytes(
        "withdrawal",
        principal,
        &[btc_address.as_bytes(), &amount_bytes, &nonce_bytes],
    )
}

fn map_withdrawal_error(error: VolumetricError) -> WalExecutionError {
    let lowercase_message = error.message.to_ascii_lowercase();
    if lowercase_message.contains("malformed address")
        || lowercase_message.contains("amount too low")
        || lowercase_message.contains("insufficient allowance")
        || lowercase_message.contains("insufficient funds")
    {
        return WalExecutionError::Permanent(error.to_string());
    }

    register_retryable_error(error)
}

fn map_withdrawal_approve_error(error: VolumetricError) -> WalExecutionError {
    let lowercase_message = error.message.to_ascii_lowercase();
    if lowercase_message.contains("approve denied")
        || lowercase_message.contains("insufficient allowance")
        || lowercase_message.contains("insufficient funds")
    {
        return WalExecutionError::Permanent(error.to_string());
    }

    register_retryable_error(error)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::rc::Rc;

    use async_trait::async_trait;
    use icrc_ledger_types::icrc2::approve::ApproveArgs;

    use crate::errors::error_codes;
    use crate::generated::ckbtc::{GetBtcAddressArg, RetrieveBtcOk, UpdateBalanceArg, UtxoStatus};
    use crate::ic::IcRuntime;
    use crate::ledger::LedgerClient;
    use crate::minter::MinterClient;
    use crate::storage::{get_balance, set_balance, UserBalance};

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const WITHDRAW_AMOUNT_SATS: u64 = 100_000;
    const INITIAL_BALANCE_SATS: u64 = 500_000;
    const EXPECTED_BLOCK_INDEX: u64 = 42;
    const TEST_BTC_ADDRESS: &str = "tb1qwithdraw";

    fn test_principal() -> Principal {
        Principal::from_slice(&[2; 29])
    }

    struct MockRuntime;

    impl IcRuntime for MockRuntime {
        fn time(&self) -> u64 {
            TEST_NOW_NS
        }
        fn canister_self(&self) -> Principal {
            Principal::anonymous()
        }
        fn log(&self, _msg: &str) {}
    }

    struct MockLedger {
        approve_result: Result<Nat, VolumetricError>,
    }

    #[async_trait(?Send)]
    impl LedgerClient for MockLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
        ) -> Result<u64, VolumetricError> {
            Ok(1)
        }
        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }
        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            self.approve_result.clone()
        }
    }

    struct MockMinter {
        retrieve_block_index: Option<u64>,
        retrieve_error: Option<VolumetricError>,
    }

    #[async_trait(?Send)]
    impl MinterClient for MockMinter {
        async fn get_btc_address(
            &self,
            _args: GetBtcAddressArg,
        ) -> Result<String, VolumetricError> {
            Ok(String::new())
        }
        async fn update_balance(
            &self,
            _args: UpdateBalanceArg,
        ) -> Result<Vec<UtxoStatus>, VolumetricError> {
            Ok(vec![])
        }
        async fn retrieve_btc_with_approval(
            &self,
            _args: RetrieveBtcWithApprovalArgs,
        ) -> Result<RetrieveBtcOk, VolumetricError> {
            match &self.retrieve_error {
                Some(e) => Err(e.clone()),
                None => Ok(RetrieveBtcOk {
                    block_index: self.retrieve_block_index.unwrap_or(0),
                }),
            }
        }
    }

    fn setup_success() {
        ic::set_runtime(Box::new(MockRuntime));
        ledger::set_ledger(Rc::new(MockLedger {
            approve_result: Ok(Nat::from(0u64)),
        }));
        minter::set_minter(Rc::new(MockMinter {
            retrieve_block_index: Some(EXPECTED_BLOCK_INDEX),
            retrieve_error: None,
        }));
    }

    fn fund_principal(principal: Principal, amount: u64) {
        set_balance(
            principal,
            UserBalance {
                available: amount,
                locked_as_writer: 0,
            },
        );
    }

    fn withdraw_params() -> WithdrawParams {
        WithdrawParams {
            btc_address: TEST_BTC_ADDRESS.to_string(),
            amount: WITHDRAW_AMOUNT_SATS,
        }
    }

    /// Given: funded account with successful mocks
    /// When: withdraw_ckbtc_use_case is called
    /// Then: returns the block index and deducts balance
    #[tokio::test]
    async fn test_withdraw_succeeds_and_deducts_balance() {
        // given
        setup_success();
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params(), 1).await;

        // then
        let withdraw_result = result.unwrap();
        assert_eq!(withdraw_result.block_index, EXPECTED_BLOCK_INDEX);

        let balance = get_balance(&principal);
        let expected_remaining = INITIAL_BALANCE_SATS - WITHDRAW_AMOUNT_SATS;
        assert_eq!(balance.available, expected_remaining);
    }

    /// Given: account with insufficient balance
    /// When: withdraw_ckbtc_use_case is called
    /// Then: returns insufficient balance error, balance unchanged
    #[tokio::test]
    async fn test_withdraw_insufficient_balance_fails() {
        // given
        setup_success();
        let principal = test_principal();
        let insufficient_amount: u64 = 50_000;
        fund_principal(principal, insufficient_amount);

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params(), 2).await;

        // then
        let err = result.unwrap_err();
        assert_eq!(err.code, error_codes::INSUFFICIENT_BALANCE.code);

        let balance = get_balance(&principal);
        assert_eq!(balance.available, insufficient_amount);
    }

    /// Given: ledger approve fails
    /// When: withdraw_ckbtc_use_case is called
    /// Then: returns error and leaves the withdrawal pending for WAL retry
    #[tokio::test]
    async fn test_withdraw_approve_failure_restores_balance() {
        // given
        ic::set_runtime(Box::new(MockRuntime));
        ledger::set_ledger(Rc::new(MockLedger {
            approve_result: Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("approve denied"),
                None,
            )),
        }));
        minter::set_minter(Rc::new(MockMinter {
            retrieve_block_index: Some(EXPECTED_BLOCK_INDEX),
            retrieve_error: None,
        }));
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params(), 3).await;

        // then
        assert!(result.is_err());
        let balance = get_balance(&principal);
        assert_eq!(balance.available, INITIAL_BALANCE_SATS);
    }

    /// Given: minter retrieve_btc_with_approval fails
    /// When: withdraw_ckbtc_use_case is called
    /// Then: returns error and restores balance
    #[tokio::test]
    async fn test_withdraw_retrieve_failure_restores_balance() {
        // given
        ic::set_runtime(Box::new(MockRuntime));
        ledger::set_ledger(Rc::new(MockLedger {
            approve_result: Ok(Nat::from(0u64)),
        }));
        minter::set_minter(Rc::new(MockMinter {
            retrieve_block_index: None,
            retrieve_error: Some(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("retrieve failed"),
                None,
            )),
        }));
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params(), 4).await;

        // then
        assert!(result.is_err());
        let balance = get_balance(&principal);
        assert_eq!(
            balance.available,
            INITIAL_BALANCE_SATS - WITHDRAW_AMOUNT_SATS
        );
    }
}

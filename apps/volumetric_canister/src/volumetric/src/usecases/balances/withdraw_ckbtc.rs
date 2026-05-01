use candid::{CandidType, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

use crate::auth::derive_subaccount;
use crate::errors::{error_codes, VolumetricError};
use crate::generated::ckbtc::RetrieveBtcWithApprovalArgs;
use crate::journaling::{
    default_policy, enqueue_if_absent, get_entry, ledger_memo, register_retryable_error,
    LedgerMemoKind, OperationId, WalEntry, WalExecutionError, WalKind, WalPayload, WalResult,
    WalStatus, WithdrawalWalPayload,
};
use crate::locks::BalanceMutationLock;
use crate::storage::{
    add_available, complete_withdrawal, create_withdrawal, emit_event, fail_withdrawal,
    get_balance, get_pending_withdrawals_by_principal, get_withdrawal, remove_withdrawal,
    subtract_available, update_withdrawal_phase, Config, EventData, EventType, WithdrawalPhase,
};
use crate::{ic, ledger, minter};

pub struct WithdrawParams {
    pub btc_address: String,
    pub amount: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct WithdrawResult {
    pub block_index: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct WithdrawReceipt {
    pub operation_id: OperationId,
    pub withdrawal_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum WithdrawStatus {
    Pending {
        receipt: WithdrawReceipt,
        phase: WithdrawalPhase,
        last_error: Option<String>,
    },
    Succeeded {
        receipt: WithdrawReceipt,
        result: WithdrawResult,
    },
    RecoveryRequired {
        receipt: WithdrawReceipt,
        phase: WithdrawalPhase,
        last_error: Option<String>,
    },
    Failed {
        receipt: WithdrawReceipt,
        message: String,
    },
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct WithdrawalWalResult {
    pub block_index: u64,
}

struct WithdrawalWalExecutionPreparation {
    operation_id: OperationId,
    withdrawal_id: u64,
}

pub fn withdraw_ckbtc_use_case(
    principal: Principal,
    params: WithdrawParams,
    request_nonce: u64,
) -> Result<WithdrawReceipt, VolumetricError> {
    let _withdrawal_balance_mutation_lock = BalanceMutationLock::new(principal)?;
    let withdraw_amount_after_fees_sats =
        validate_gross_ckbtc_withdraw_or_reject(principal, params.amount)?;

    if !get_pending_withdrawals_by_principal(principal).is_empty() {
        return Err(VolumetricError::from_def(
            error_codes::WITHDRAWAL_IN_PROGRESS,
            None,
            None,
        ));
    }

    let operation_id =
        withdraw_operation_id(principal, &params.btc_address, params.amount, request_nonce);

    if let Some(existing_withdraw_receipt) = load_withdraw_receipt_if_exists(operation_id)? {
        return Ok(existing_withdraw_receipt);
    }

    let gross_withdraw_amount_sats = params.amount;

    let withdrawal_wal_execution_preparation = enqueue_ckbtc_withdraw_wal_after_debit(
        principal,
        params,
        operation_id,
        withdraw_amount_after_fees_sats,
    )?;
    let withdraw_receipt = WithdrawReceipt {
        operation_id: withdrawal_wal_execution_preparation.operation_id,
        withdrawal_id: withdrawal_wal_execution_preparation.withdrawal_id,
    };
    schedule_withdraw_wal_execution(withdraw_receipt.operation_id);

    logging::log!(
        "withdraw_ckbtc enqueued operation_id={:?} principal={} withdrawal_id={} gross_amount_sats={}",
        withdraw_receipt.operation_id,
        principal,
        withdraw_receipt.withdrawal_id,
        gross_withdraw_amount_sats
    );

    Ok(withdraw_receipt)
}

pub fn get_withdraw_status_use_case(
    operation_id: OperationId,
) -> Result<WithdrawStatus, VolumetricError> {
    let wal_entry = get_entry(operation_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("withdrawal not found"),
            None,
        )
    })?;
    let withdraw_receipt = build_withdraw_receipt_from_wal_entry(operation_id, &wal_entry)?;

    match wal_entry.status {
        WalStatus::Succeeded => Ok(WithdrawStatus::Succeeded {
            receipt: withdraw_receipt,
            result: load_withdraw_wal_result(operation_id)?,
        }),
        WalStatus::FailedPermanent => Ok(WithdrawStatus::Failed {
            receipt: withdraw_receipt.clone(),
            message: load_failed_withdraw_message(
                withdraw_receipt.withdrawal_id,
                wal_entry.last_err,
            )?,
        }),
        WalStatus::Enqueued | WalStatus::InFlight => {
            let pending_withdrawal = load_withdraw_journal_entry(withdraw_receipt.withdrawal_id)?;
            Ok(WithdrawStatus::Pending {
                receipt: withdraw_receipt,
                phase: pending_withdrawal.phase,
                last_error: wal_entry.last_err,
            })
        }
        WalStatus::RecoveryRequired => {
            let pending_withdrawal = load_withdraw_journal_entry(withdraw_receipt.withdrawal_id)?;
            Ok(WithdrawStatus::RecoveryRequired {
                receipt: withdraw_receipt,
                phase: pending_withdrawal.phase,
                last_error: wal_entry.last_err,
            })
        }
    }
}

fn load_withdraw_receipt_if_exists(
    operation_id: OperationId,
) -> Result<Option<WithdrawReceipt>, VolumetricError> {
    let Some(existing_entry) = get_entry(operation_id) else {
        return Ok(None);
    };

    build_withdraw_receipt_from_wal_entry(operation_id, &existing_entry).map(Some)
}

fn build_withdraw_receipt_from_wal_entry(
    operation_id: OperationId,
    wal_entry: &WalEntry,
) -> Result<WithdrawReceipt, VolumetricError> {
    let WalPayload::Withdrawal(payload) = &wal_entry.payload else {
        return Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("withdraw receipt loaded from unexpected wal payload"),
            None,
        ));
    };

    Ok(WithdrawReceipt {
        operation_id,
        withdrawal_id: payload.withdrawal_id,
    })
}

fn enqueue_ckbtc_withdraw_wal_after_debit(
    principal: Principal,
    params: WithdrawParams,
    operation_id: OperationId,
    withdraw_amount_after_fees_sats: u64,
) -> Result<WithdrawalWalExecutionPreparation, VolumetricError> {
    debit_withdrawer_available_balance(principal, params.amount)?;

    let ledger_transfer_created_at_time_ns = ic::time();
    let withdrawal = create_withdrawal(
        principal,
        params.amount,
        params.btc_address.clone(),
        ledger_transfer_created_at_time_ns,
    );

    enqueue_if_absent(
        operation_id,
        WalKind::Withdrawal,
        WalPayload::Withdrawal(WithdrawalWalPayload {
            withdrawal_id: withdrawal.id,
            principal,
            gross_withdraw_amount_sats: params.amount,
            withdraw_amount_after_fees_sats,
            btc_address: params.btc_address,
            created_at_time_ns: ledger_transfer_created_at_time_ns,
        }),
        default_policy(),
    );

    Ok(WithdrawalWalExecutionPreparation {
        operation_id,
        withdrawal_id: withdrawal.id,
    })
}

fn debit_withdrawer_available_balance(
    principal: Principal,
    amount_sats: u64,
) -> Result<(), VolumetricError> {
    subtract_available(principal, amount_sats).map_err(|error| {
        VolumetricError::from_def(
            error_codes::INSUFFICIENT_BALANCE,
            Some(&format!(
                "available: {}, required: {}",
                error.available, error.required
            )),
            None,
        )
    })
}

fn validate_gross_ckbtc_withdraw_or_reject(
    principal: Principal,
    gross_withdraw_amount_sats: u64,
) -> Result<u64, VolumetricError> {
    let transfer_fee_sats = ledger::get_cached_icrc1_transfer_fee_sats_for_sync_flow()?;
    let ledger_fee_reserve_sats =
        ledger::withdraw_ckbtc_ledger_fee_reserve_sats_for_transfer_fee(transfer_fee_sats);
    let minimum_net_withdraw_amount_sats = Config::trading_limits().withdraw_amount_sats;

    if gross_withdraw_amount_sats < ledger_fee_reserve_sats {
        return Err(VolumetricError::from_def(
            error_codes::INSUFFICIENT_BALANCE,
            Some(&format!(
                "gross_withdraw_amount_sats: {} is below ledger_fee_reserve: {}",
                gross_withdraw_amount_sats, ledger_fee_reserve_sats
            )),
            None,
        ));
    }

    let withdraw_amount_after_fees_sats = gross_withdraw_amount_sats
        .checked_sub(ledger_fee_reserve_sats)
        .ok_or_else(|| {
            VolumetricError::from_def(
                error_codes::INTERNAL_ERROR,
                Some("withdraw net amount underflow"),
                None,
            )
        })?;

    if withdraw_amount_after_fees_sats < minimum_net_withdraw_amount_sats {
        return Err(VolumetricError::from_def(
            error_codes::QUANTITY_BELOW_MINIMUM,
            Some(&format!(
                "withdraw_amount_after_fees_sats: {} is below minimum_withdraw: {}",
                withdraw_amount_after_fees_sats, minimum_net_withdraw_amount_sats
            )),
            None,
        ));
    }

    let available_sats = get_balance(&principal).available;
    if available_sats < gross_withdraw_amount_sats {
        return Err(VolumetricError::from_def(
            error_codes::INSUFFICIENT_BALANCE,
            Some(&format!(
                "available: {}, required_gross_withdraw_amount_sats: {}",
                available_sats, gross_withdraw_amount_sats
            )),
            None,
        ));
    }

    Ok(withdraw_amount_after_fees_sats)
}

fn schedule_withdraw_wal_execution(operation_id: OperationId) {
    #[cfg(target_arch = "wasm32")]
    ic_cdk::futures::spawn(async move {
        let _ = crate::journaling::execute_wal_entry_now(operation_id).await;
    });

    #[cfg(not(target_arch = "wasm32"))]
    let _ = operation_id;
}

pub(crate) fn finalize_failed_withdrawal_wal(payload: &WithdrawalWalPayload, message: &str) {
    let Some(withdrawal) = get_withdrawal(payload.withdrawal_id) else {
        logging::warn!(
            "finalize_failed_withdrawal_wal missing journal withdrawal_id={} principal={} message={}",
            payload.withdrawal_id,
            payload.principal,
            message
        );
        return;
    };

    if matches!(
        withdrawal.phase,
        WithdrawalPhase::Failed { .. } | WithdrawalPhase::Completed { .. }
    ) {
        logging::log!(
            "finalize_failed_withdrawal_wal skipped withdrawal_id={} principal={} phase={:?} message={}",
            payload.withdrawal_id,
            payload.principal,
            withdrawal.phase,
            message
        );
        return;
    }

    let approve_fee_sats = withdrawal_approve_fee_sats(payload);
    let refund_amount_sats = failed_withdrawal_refund_amount_sats(payload, &withdrawal.phase);
    let withheld_approve_fee_sats = payload
        .gross_withdraw_amount_sats
        .saturating_sub(refund_amount_sats);

    logging::error!(
        "finalize_failed_withdrawal_wal refunding withdrawal_id={} principal={} phase={:?} \
         gross_sats={} net_sats={} approve_fee_sats={} refund_sats={} withheld_approve_fee_sats={} message={}",
        payload.withdrawal_id,
        payload.principal,
        withdrawal.phase,
        payload.gross_withdraw_amount_sats,
        payload.withdraw_amount_after_fees_sats,
        approve_fee_sats,
        refund_amount_sats,
        withheld_approve_fee_sats,
        message
    );

    add_available(payload.principal, refund_amount_sats);
    fail_withdrawal(payload.withdrawal_id, message.to_string());
}

fn failed_withdrawal_refund_amount_sats(
    payload: &WithdrawalWalPayload,
    phase: &WithdrawalPhase,
) -> u64 {
    if matches!(phase, WithdrawalPhase::Started) {
        return payload.gross_withdraw_amount_sats;
    }

    payload
        .gross_withdraw_amount_sats
        .saturating_sub(withdrawal_approve_fee_sats(payload))
}

fn withdrawal_approve_fee_sats(payload: &WithdrawalWalPayload) -> u64 {
    let reserved_ledger_fee_sats = payload
        .gross_withdraw_amount_sats
        .saturating_sub(payload.withdraw_amount_after_fees_sats);

    reserved_ledger_fee_sats / ledger::CKBTC_WITHDRAW_ICRC2_LEDGER_FEE_CHARGE_COUNT
}

fn load_withdraw_wal_result(operation_id: OperationId) -> Result<WithdrawResult, VolumetricError> {
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

    match wal_result {
        WalResult::Withdrawal(result) => Ok(WithdrawResult {
            block_index: result.block_index,
        }),
        _ => Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("withdrawal completed with unexpected wal result type"),
            None,
        )),
    }
}

fn load_withdraw_journal_entry(
    withdrawal_id: u64,
) -> Result<crate::storage::PendingWithdrawal, VolumetricError> {
    get_withdrawal(withdrawal_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("withdrawal journal entry not found"),
            None,
        )
    })
}

fn load_failed_withdraw_message(
    withdrawal_id: u64,
    wal_last_error: Option<String>,
) -> Result<String, VolumetricError> {
    if let Some(withdrawal) = get_withdrawal(withdrawal_id) {
        if let WithdrawalPhase::Failed { reason } = withdrawal.phase {
            return Ok(reason);
        }
    }

    wal_last_error.ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("failed withdrawal missing error message"),
            None,
        )
    })
}

pub async fn run_withdrawal_wal(
    operation_id: OperationId,
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
            amount: Nat::from(payload.withdraw_amount_after_fees_sats),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: Some(ledger_memo(
                operation_id,
                LedgerMemoKind::WithdrawalApprove,
                &[],
            )),
            created_at_time: Some(payload.created_at_time_ns),
        };

        logging::log!(
            "withdraw_ckbtc approve start operation_id={:?} withdrawal_id={} principal={} approve_amount_sats={}",
            operation_id,
            payload.withdrawal_id,
            payload.principal,
            payload.withdraw_amount_after_fees_sats
        );

        ledger::icrc2_approve(approve_args)
            .await
            .map_err(|error| {
                logging::warn!(
                    "withdraw_ckbtc approve failed operation_id={:?} withdrawal_id={} principal={} error={}",
                    operation_id,
                    payload.withdrawal_id,
                    payload.principal,
                    error
                );
                map_withdrawal_approve_error(error)
            })?;

        logging::log!(
            "withdraw_ckbtc approve ok operation_id={:?} withdrawal_id={} principal={}",
            operation_id,
            payload.withdrawal_id,
            payload.principal
        );

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
            amount: payload.withdraw_amount_after_fees_sats,
            from_subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
        };

        logging::log!(
            "withdraw_ckbtc retrieve start operation_id={:?} withdrawal_id={} principal={} retrieve_amount_sats={} btc_address={}",
            operation_id,
            payload.withdrawal_id,
            payload.principal,
            payload.withdraw_amount_after_fees_sats,
            payload.btc_address
        );

        let retrieve_result = minter::retrieve_btc_with_approval(retrieve_args).await;
        let retrieve_ok = match retrieve_result {
            Ok(ok) => ok,
            Err(error) => {
                logging::warn!(
                    "withdraw_ckbtc retrieve failed operation_id={:?} withdrawal_id={} principal={} retrieve_amount_sats={} error={}",
                    operation_id,
                    payload.withdrawal_id,
                    payload.principal,
                    payload.withdraw_amount_after_fees_sats,
                    error
                );
                return Err(map_withdrawal_error(error));
            }
        };

        logging::log!(
            "withdraw_ckbtc retrieve ok operation_id={:?} withdrawal_id={} principal={} block_index={}",
            operation_id,
            payload.withdrawal_id,
            payload.principal,
            retrieve_ok.block_index
        );

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
                amount_sats: payload.withdraw_amount_after_fees_sats,
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

fn withdraw_operation_id(
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
    use std::cell::{Cell, RefCell};
    use std::rc::Rc;

    use async_trait::async_trait;
    use icrc_ledger_types::icrc1::transfer::Memo;
    use icrc_ledger_types::icrc2::approve::ApproveArgs;

    use crate::errors::error_codes;
    use crate::generated::ckbtc::{GetBtcAddressArg, RetrieveBtcOk, UpdateBalanceArg, UtxoStatus};
    use crate::ic::IcRuntime;
    use crate::ledger::LedgerClient;
    use crate::minter::MinterClient;
    use crate::storage::{
        get_balance, get_pending_withdrawals_by_principal, get_withdrawal, set_balance,
        UserBalance, WithdrawalPhase,
    };

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const WITHDRAW_AMOUNT_SATS: u64 = 100_000;
    const INITIAL_BALANCE_SATS: u64 = 500_000;
    const EXPECTED_BLOCK_INDEX: u64 = 42;
    const TEST_BTC_ADDRESS: &str = "tb1qwithdraw";
    const TEST_TRANSFER_FEE_SATS: u64 = 10;
    const EXPECTED_APPROVE_FEE_SATS: u64 = TEST_TRANSFER_FEE_SATS;

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
        last_approve_amount: RefCell<Option<Nat>>,
        last_approve_memo: RefCell<Option<Memo>>,
    }

    #[async_trait(?Send)]
    impl LedgerClient for MockLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
            _memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            Ok(1)
        }
        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }
        async fn icrc2_approve(&self, args: ApproveArgs) -> Result<Nat, VolumetricError> {
            self.last_approve_amount.replace(Some(args.amount));
            self.last_approve_memo.replace(args.memo);
            self.approve_result.clone()
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(10)
        }
    }

    struct MockMinter {
        retrieve_block_index: Option<u64>,
        retrieve_error: Option<VolumetricError>,
        last_retrieve_amount_sats: Cell<Option<u64>>,
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
            args: RetrieveBtcWithApprovalArgs,
        ) -> Result<RetrieveBtcOk, VolumetricError> {
            self.last_retrieve_amount_sats.set(Some(args.amount));
            match &self.retrieve_error {
                Some(e) => Err(e.clone()),
                None => Ok(RetrieveBtcOk {
                    block_index: self.retrieve_block_index.unwrap_or(0),
                }),
            }
        }
    }

    struct RetryableThenPermanentMinter {
        retrieve_call_count: Cell<u32>,
    }

    #[async_trait(?Send)]
    impl MinterClient for RetryableThenPermanentMinter {
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
            let retrieve_call_count = self.retrieve_call_count.get();
            self.retrieve_call_count
                .set(retrieve_call_count.saturating_add(1));

            if retrieve_call_count == 0 {
                return Err(VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some("temporarily unavailable"),
                    None,
                ));
            }

            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("malformed address"),
                None,
            ))
        }
    }

    fn setup_success() {
        ic::set_runtime(Box::new(MockRuntime));
        Config::set_withdraw_amount_sats(50_000);
        ledger::set_ledger(Rc::new(MockLedger {
            approve_result: Ok(Nat::from(0u64)),
            last_approve_amount: RefCell::new(None),
            last_approve_memo: RefCell::new(None),
        }));
        ledger::set_cached_transfer_fee_for_testing(TEST_TRANSFER_FEE_SATS, TEST_NOW_NS);
        minter::set_minter(Rc::new(MockMinter {
            retrieve_block_index: Some(EXPECTED_BLOCK_INDEX),
            retrieve_error: None,
            last_retrieve_amount_sats: Cell::new(None),
        }));
    }

    fn setup_success_with_recorders() -> (Rc<MockLedger>, Rc<MockMinter>) {
        ic::set_runtime(Box::new(MockRuntime));
        Config::set_withdraw_amount_sats(50_000);

        let ledger = Rc::new(MockLedger {
            approve_result: Ok(Nat::from(0u64)),
            last_approve_amount: RefCell::new(None),
            last_approve_memo: RefCell::new(None),
        });
        ledger::set_ledger(ledger.clone());
        ledger::set_cached_transfer_fee_for_testing(TEST_TRANSFER_FEE_SATS, TEST_NOW_NS);

        let minter = Rc::new(MockMinter {
            retrieve_block_index: Some(EXPECTED_BLOCK_INDEX),
            retrieve_error: None,
            last_retrieve_amount_sats: Cell::new(None),
        });
        minter::set_minter(minter.clone());

        (ledger, minter)
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
        let receipt = withdraw_ckbtc_use_case(principal, withdraw_params(), 1).unwrap();
        let wal_execution_outcome =
            crate::journaling::execute_wal_entry_now(receipt.operation_id).await;
        let status = get_withdraw_status_use_case(receipt.operation_id).unwrap();

        // then
        assert!(matches!(
            wal_execution_outcome,
            crate::journaling::WalExecutionOutcome::Succeeded
        ));
        match status {
            WithdrawStatus::Succeeded { result, .. } => {
                assert_eq!(result.block_index, EXPECTED_BLOCK_INDEX);
            }
            _ => panic!("withdrawal should be succeeded"),
        }

        let balance = get_balance(&principal);
        let expected_remaining = INITIAL_BALANCE_SATS - WITHDRAW_AMOUNT_SATS;
        assert_eq!(balance.available, expected_remaining);
    }

    /// Given: a withdrawal request whose gross amount covers the minimum plus two fees
    /// When: withdraw_ckbtc_use_case is called
    /// Then: it debits the gross amount and sends the net amount to the minter
    #[tokio::test]
    async fn test_withdraw_uses_requested_amount_as_gross_and_sends_net_after_fees() {
        // given
        let (ledger, minter) = setup_success_with_recorders();
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);
        const REQUESTED_GROSS_WITHDRAW_SATS: u64 = 50_020;
        const EXPECTED_NET_WITHDRAW_SATS: u64 = 50_000;
        let withdraw_params = WithdrawParams {
            btc_address: TEST_BTC_ADDRESS.to_string(),
            amount: REQUESTED_GROSS_WITHDRAW_SATS,
        };

        // when
        let receipt = withdraw_ckbtc_use_case(principal, withdraw_params, 31).unwrap();
        let wal_execution_outcome =
            crate::journaling::execute_wal_entry_now(receipt.operation_id).await;

        // then
        assert!(matches!(
            wal_execution_outcome,
            crate::journaling::WalExecutionOutcome::Succeeded
        ));

        let recorded_approve_amount = ledger
            .last_approve_amount
            .borrow()
            .clone()
            .expect("approve amount should be recorded");
        assert_eq!(
            recorded_approve_amount,
            Nat::from(EXPECTED_NET_WITHDRAW_SATS)
        );
        let expected_approve_memo =
            ledger_memo(receipt.operation_id, LedgerMemoKind::WithdrawalApprove, &[]);
        assert_eq!(
            *ledger.last_approve_memo.borrow(),
            Some(expected_approve_memo)
        );

        let recorded_retrieve_amount_sats = minter
            .last_retrieve_amount_sats
            .get()
            .expect("retrieve amount should be recorded");
        assert_eq!(recorded_retrieve_amount_sats, EXPECTED_NET_WITHDRAW_SATS);

        let balance = get_balance(&principal);
        let expected_remaining = INITIAL_BALANCE_SATS - REQUESTED_GROSS_WITHDRAW_SATS;
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
        let result = withdraw_ckbtc_use_case(principal, withdraw_params(), 2);

        // then
        let err = result.unwrap_err();
        assert_eq!(err.code, error_codes::INSUFFICIENT_BALANCE.code);

        let balance = get_balance(&principal);
        assert_eq!(balance.available, insufficient_amount);
    }

    /// Given: available balance is less than the requested gross withdrawal
    /// When: withdraw_ckbtc_use_case is called
    /// Then: it returns insufficient balance and does not debit
    #[tokio::test]
    async fn test_withdraw_rejects_when_gross_exceeds_available_balance() {
        // given
        setup_success();
        let principal = test_principal();
        const AVAILABLE_SATS: u64 = WITHDRAW_AMOUNT_SATS - 1;
        fund_principal(principal, AVAILABLE_SATS);

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params(), 212);

        // then
        let error = result.expect_err("withdraw should reject when gross exceeds available");
        assert_eq!(error.code, error_codes::INSUFFICIENT_BALANCE.code);

        let balance = get_balance(&principal);
        assert_eq!(balance.available, AVAILABLE_SATS);
    }

    /// Given: a gross withdraw amount smaller than the two-transfer ledger fee reserve
    /// When: withdraw_ckbtc_use_case is called
    /// Then: it rejects with insufficient balance before debiting balance
    #[tokio::test]
    async fn test_withdraw_rejects_gross_below_ledger_fee_reserve() {
        // given
        setup_success();
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);
        const GROSS_BELOW_LEDGER_FEE_RESERVE_SATS: u64 = 19;
        let withdraw_params = WithdrawParams {
            btc_address: TEST_BTC_ADDRESS.to_string(),
            amount: GROSS_BELOW_LEDGER_FEE_RESERVE_SATS,
        };

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params, 21);

        // then
        let error = result.expect_err("withdraw should reject gross below ledger fee reserve");
        assert_eq!(error.code, error_codes::INSUFFICIENT_BALANCE.code);

        let balance = get_balance(&principal);
        assert_eq!(balance.available, INITIAL_BALANCE_SATS);
    }

    /// Given: gross covers the ledger fee reserve but net is still below the configured minimum
    /// When: withdraw_ckbtc_use_case is called
    /// Then: it rejects with quantity-below-minimum before debiting balance
    #[tokio::test]
    async fn test_withdraw_rejects_net_below_minimum_when_gross_covers_fee_reserve() {
        // given
        setup_success();
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);
        const EXPECTED_LEDGER_FEE_RESERVE_SATS: u64 = TEST_TRANSFER_FEE_SATS * 2;
        const MINIMUM_NET_WITHDRAW_SATS: u64 = 50_000;
        const GROSS_ONE_BELOW_MINIMUM_NET_SATS: u64 =
            MINIMUM_NET_WITHDRAW_SATS + EXPECTED_LEDGER_FEE_RESERVE_SATS - 1;
        let withdraw_params = WithdrawParams {
            btc_address: TEST_BTC_ADDRESS.to_string(),
            amount: GROSS_ONE_BELOW_MINIMUM_NET_SATS,
        };

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params, 211);

        // then
        let error = result.expect_err("withdraw should reject when net is below minimum");
        assert_eq!(error.code, error_codes::QUANTITY_BELOW_MINIMUM.code);

        let balance = get_balance(&principal);
        assert_eq!(balance.available, INITIAL_BALANCE_SATS);
    }

    /// Given: the transfer-fee cache is stale
    /// When: withdraw_ckbtc_use_case is called
    /// Then: it rejects the request and asks the caller to retry shortly
    #[tokio::test]
    async fn test_withdraw_rejects_when_transfer_fee_cache_is_stale() {
        // given
        setup_success();
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);
        ledger::set_cached_transfer_fee_for_testing(TEST_TRANSFER_FEE_SATS, 0);

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params(), 22);

        // then
        let error = result.expect_err("withdraw should reject stale fee cache");
        assert_eq!(error.code, error_codes::CONFIG_ERROR.code);
    }

    /// Given: ledger approve fails before ckBTC charges an approval fee
    /// When: withdraw_ckbtc_use_case is called
    /// Then: returns error and restores the full gross withdrawal amount
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
            last_approve_amount: RefCell::new(None),
            last_approve_memo: RefCell::new(None),
        }));
        ledger::set_cached_transfer_fee_for_testing(TEST_TRANSFER_FEE_SATS, TEST_NOW_NS);
        minter::set_minter(Rc::new(MockMinter {
            retrieve_block_index: Some(EXPECTED_BLOCK_INDEX),
            retrieve_error: None,
            last_retrieve_amount_sats: Cell::new(None),
        }));
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);

        // when
        let receipt = withdraw_ckbtc_use_case(principal, withdraw_params(), 3).unwrap();
        let wal_execution_outcome =
            crate::journaling::execute_wal_entry_now(receipt.operation_id).await;
        let status = get_withdraw_status_use_case(receipt.operation_id).unwrap();

        // then
        assert!(matches!(
            wal_execution_outcome,
            crate::journaling::WalExecutionOutcome::FailedPermanent(_)
        ));
        match status {
            WithdrawStatus::Failed { .. } => {}
            _ => panic!("withdrawal should be failed"),
        }
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
            last_approve_amount: RefCell::new(None),
            last_approve_memo: RefCell::new(None),
        }));
        ledger::set_cached_transfer_fee_for_testing(TEST_TRANSFER_FEE_SATS, TEST_NOW_NS);
        minter::set_minter(Rc::new(MockMinter {
            retrieve_block_index: None,
            retrieve_error: Some(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("retrieve failed"),
                None,
            )),
            last_retrieve_amount_sats: Cell::new(None),
        }));
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);

        // when
        let receipt = withdraw_ckbtc_use_case(principal, withdraw_params(), 4).unwrap();
        let wal_execution_outcome =
            crate::journaling::execute_wal_entry_now(receipt.operation_id).await;
        let status = get_withdraw_status_use_case(receipt.operation_id).unwrap();

        // then
        assert!(matches!(
            wal_execution_outcome,
            crate::journaling::WalExecutionOutcome::RecoveryRequired(_)
        ));
        match status {
            WithdrawStatus::RecoveryRequired { .. } => {}
            _ => panic!("withdrawal should require recovery after ambiguous failure"),
        }
        let balance = get_balance(&principal);
        assert_eq!(
            balance.available,
            INITIAL_BALANCE_SATS - WITHDRAW_AMOUNT_SATS
        );
    }

    /// Given: a withdrawal first fails retryably after approval, then fails permanently on a later WAL attempt
    /// When: WAL execution is retried after the initial request returns pending-retry
    /// Then: the recoverable amount is refunded and the charged approve fee remains debited
    #[tokio::test]
    async fn test_withdraw_retry_to_permanent_failure_refunds_after_approve_fee() {
        // given
        ic::set_runtime(Box::new(MockRuntime));
        ledger::set_ledger(Rc::new(MockLedger {
            approve_result: Ok(Nat::from(0u64)),
            last_approve_amount: RefCell::new(None),
            last_approve_memo: RefCell::new(None),
        }));
        ledger::set_cached_transfer_fee_for_testing(TEST_TRANSFER_FEE_SATS, TEST_NOW_NS);
        minter::set_minter(Rc::new(RetryableThenPermanentMinter {
            retrieve_call_count: Cell::new(0),
        }));
        let principal = test_principal();
        let request_nonce = 8;
        fund_principal(principal, INITIAL_BALANCE_SATS);

        // when
        let first_receipt = withdraw_ckbtc_use_case(principal, withdraw_params(), request_nonce)
            .expect("first request should enqueue withdrawal");
        let first_status = get_withdraw_status_use_case(first_receipt.operation_id)
            .expect("status should load after enqueue");
        let operation_id = withdraw_operation_id(
            principal,
            TEST_BTC_ADDRESS,
            WITHDRAW_AMOUNT_SATS,
            request_nonce,
        );
        let first_attempt_outcome = crate::journaling::execute_wal_entry_now(operation_id).await;
        let second_attempt_outcome = crate::journaling::execute_wal_entry_now(operation_id).await;

        // then
        assert!(matches!(first_status, WithdrawStatus::Pending { .. }));
        assert!(matches!(
            first_attempt_outcome,
            crate::journaling::WalExecutionOutcome::RecoveryRequired(_)
        ));
        assert!(matches!(
            second_attempt_outcome,
            crate::journaling::WalExecutionOutcome::FailedPermanent(_)
        ));

        let balance = get_balance(&principal);
        let expected_available_sats = INITIAL_BALANCE_SATS - EXPECTED_APPROVE_FEE_SATS;
        assert_eq!(balance.available, expected_available_sats);

        let pending_withdrawals = get_pending_withdrawals_by_principal(principal);
        const EXPECTED_PENDING_WITHDRAWALS_LEN: usize = 0;
        assert_eq!(pending_withdrawals.len(), EXPECTED_PENDING_WITHDRAWALS_LEN);

        let withdrawal_id = 1;
        let failed_withdrawal =
            get_withdrawal(withdrawal_id).expect("failed withdrawal journal should still exist");
        assert!(matches!(
            failed_withdrawal.phase,
            WithdrawalPhase::Failed { .. }
        ));
    }

    /// Given: failed withdrawal payloads before and after approval
    /// When: calculating the failed withdrawal refund
    /// Then: only post-approval failures retain the one irrecoverable approve fee
    #[test]
    fn test_failed_withdrawal_refund_amount_depends_on_approval_phase() {
        // given
        let payload = WithdrawalWalPayload {
            withdrawal_id: 1,
            principal: test_principal(),
            gross_withdraw_amount_sats: WITHDRAW_AMOUNT_SATS,
            withdraw_amount_after_fees_sats: WITHDRAW_AMOUNT_SATS
                - (TEST_TRANSFER_FEE_SATS * ledger::CKBTC_WITHDRAW_ICRC2_LEDGER_FEE_CHARGE_COUNT),
            btc_address: TEST_BTC_ADDRESS.to_string(),
            created_at_time_ns: TEST_NOW_NS,
        };

        // when
        let started_refund_sats =
            failed_withdrawal_refund_amount_sats(&payload, &WithdrawalPhase::Started);
        let approved_refund_sats =
            failed_withdrawal_refund_amount_sats(&payload, &WithdrawalPhase::Approved);

        // then
        const EXPECTED_STARTED_REFUND_SATS: u64 = WITHDRAW_AMOUNT_SATS;
        const EXPECTED_APPROVED_REFUND_SATS: u64 = WITHDRAW_AMOUNT_SATS - EXPECTED_APPROVE_FEE_SATS;
        assert_eq!(started_refund_sats, EXPECTED_STARTED_REFUND_SATS);
        assert_eq!(approved_refund_sats, EXPECTED_APPROVED_REFUND_SATS);
    }

    /// Given: configured minimum withdraw amount exceeds requested amount
    /// When: withdraw_ckbtc_use_case is called
    /// Then: request is rejected at boundary with quantity-below-minimum error
    #[tokio::test]
    async fn test_withdraw_rejects_amount_below_configured_minimum() {
        // given
        setup_success();
        Config::set_withdraw_amount_sats(WITHDRAW_AMOUNT_SATS.saturating_add(1));
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params(), 9);

        // then
        let error = result.expect_err("withdraw should reject amount below configured minimum");
        assert_eq!(error.code, error_codes::QUANTITY_BELOW_MINIMUM.code);
    }
}

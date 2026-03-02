use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::generated::ckbtc::RetrieveBtcWithApprovalArgs;
use crate::locks::WithdrawalLock;
use crate::storage::{
    add_available, complete_withdrawal, create_withdrawal, emit_event, fail_withdrawal,
    remove_withdrawal, subtract_available, update_withdrawal_phase, Config, EventData, EventType,
    WithdrawalPhase,
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

pub async fn withdraw_ckbtc_use_case(
    principal: Principal,
    params: WithdrawParams,
) -> Result<WithdrawResult, VolumetricError> {
    // bind to _lock, not `let _ =` which drops immediately
    let _lock = WithdrawalLock::new(principal)?;

    subtract_available(principal, params.amount)
        .map_err(|e| VolumetricError::insufficient_balance(e.available, e.required))?;

    let subaccount = derive_subaccount(principal);
    let minter = Config::ckbtc_minter();
    let created_at_time = ic::time();

    let withdrawal = create_withdrawal(
        principal,
        params.amount,
        params.btc_address.clone(),
        created_at_time,
    );
    let withdrawal_id = withdrawal.id;

    let approve_args = icrc_ledger_types::icrc2::approve::ApproveArgs {
        from_subaccount: Some(subaccount),
        spender: Account {
            owner: minter,
            subaccount: None,
        },
        amount: Nat::from(params.amount),
        expected_allowance: None,
        expires_at: None,
        fee: None,
        memo: None,
        created_at_time: Some(created_at_time),
    };

    if let Err(e) = ledger::icrc2_approve(approve_args).await {
        add_available(principal, params.amount);
        fail_withdrawal(withdrawal_id, format!("icrc2_approve failed: {:?}", e));
        return Err(e);
    }

    update_withdrawal_phase(withdrawal_id, WithdrawalPhase::Approved);

    let btc_address = params.btc_address.clone();
    let retrieve_args = RetrieveBtcWithApprovalArgs {
        address: params.btc_address,
        amount: params.amount,
        from_subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    match minter::retrieve_btc_with_approval(retrieve_args).await {
        Ok(ok) => {
            update_withdrawal_phase(
                withdrawal_id,
                WithdrawalPhase::RetrieveRequested {
                    block_index: ok.block_index,
                },
            );
            complete_withdrawal(withdrawal_id, ok.block_index);
            remove_withdrawal(withdrawal_id);

            emit_event(
                principal,
                EventType::Withdrawal,
                EventData::Withdrawal {
                    amount_sats: params.amount,
                    destination: btc_address,
                },
            );

            Ok(WithdrawResult {
                block_index: ok.block_index,
            })
        }
        Err(e) => {
            add_available(principal, params.amount);
            let reason = format!("retrieve_btc_with_approval failed: {:?}", e);
            fail_withdrawal(withdrawal_id, reason.clone());

            emit_event(
                principal,
                EventType::WithdrawalFailed,
                EventData::WithdrawalFailed {
                    amount_sats: params.amount,
                    reason,
                },
            );

            Err(e)
        }
    }
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
    const MOCK_TRANSFER_FEE_SATS: u64 = 10;
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
            _expected_fee: Option<u64>,
        ) -> Result<u64, VolumetricError> {
            Ok(1)
        }
        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }
        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            self.approve_result.clone()
        }
        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(MOCK_TRANSFER_FEE_SATS)
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
        let result = withdraw_ckbtc_use_case(principal, withdraw_params()).await;

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
        let result = withdraw_ckbtc_use_case(principal, withdraw_params()).await;

        // then
        let err = result.unwrap_err();
        assert_eq!(err.code, error_codes::INSUFFICIENT_BALANCE.code);

        let balance = get_balance(&principal);
        assert_eq!(balance.available, insufficient_amount);
    }

    /// Given: ledger approve fails
    /// When: withdraw_ckbtc_use_case is called
    /// Then: returns error and restores balance
    #[tokio::test]
    async fn test_withdraw_approve_failure_restores_balance() {
        // given
        ic::set_runtime(Box::new(MockRuntime));
        ledger::set_ledger(Rc::new(MockLedger {
            approve_result: Err(VolumetricError::inter_canister_call_failed(
                "approve denied",
            )),
        }));
        minter::set_minter(Rc::new(MockMinter {
            retrieve_block_index: Some(EXPECTED_BLOCK_INDEX),
            retrieve_error: None,
        }));
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params()).await;

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
            retrieve_error: Some(VolumetricError::inter_canister_call_failed(
                "retrieve failed",
            )),
        }));
        let principal = test_principal();
        fund_principal(principal, INITIAL_BALANCE_SATS);

        // when
        let result = withdraw_ckbtc_use_case(principal, withdraw_params()).await;

        // then
        assert!(result.is_err());
        let balance = get_balance(&principal);
        assert_eq!(balance.available, INITIAL_BALANCE_SATS);
    }
}

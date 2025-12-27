use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::approve::ApproveError;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::generated::ckbtc::{
    RetrieveBtcOk, RetrieveBtcWithApprovalArgs, RetrieveBtcWithApprovalError,
};
use crate::locks::WithdrawalLock;
use crate::storage::{add_available, subtract_available, Config};

pub struct WithdrawParams {
    pub btc_address: String,
    pub amount: u64,
}

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
    let ledger = Config::ckbtc_ledger();
    let created_at_time = ic_cdk::api::time();

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

    let approve_response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc2_approve")
        .with_arg(&approve_args)
        .await;

    if let Err(e) = approve_response {
        add_available(principal, params.amount);
        return Err(VolumetricError::inter_canister_call_failed(&format!(
            "icrc2_approve: {:?}",
            e
        )));
    }

    let approve_result: Result<Nat, ApproveError> =
        approve_response.unwrap().candid().map_err(|e| {
            add_available(principal, params.amount);
            VolumetricError::inter_canister_call_failed(&format!("icrc2_approve decode: {:?}", e))
        })?;

    match approve_result {
        Ok(_) => {}
        Err(ApproveError::Duplicate { duplicate_of: _ }) => {}
        Err(e) => {
            add_available(principal, params.amount);
            return Err(VolumetricError::inter_canister_call_failed(&format!(
                "icrc2_approve rejected: {:?}",
                e
            )));
        }
    }

    let retrieve_args = RetrieveBtcWithApprovalArgs {
        address: params.btc_address,
        amount: params.amount,
        from_subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let retrieve_response =
        ic_cdk::call::Call::unbounded_wait(minter, "retrieve_btc_with_approval")
            .with_arg(&retrieve_args)
            .await;

    if let Err(e) = retrieve_response {
        add_available(principal, params.amount);
        return Err(VolumetricError::inter_canister_call_failed(&format!(
            "retrieve_btc_with_approval: {:?}",
            e
        )));
    }

    let retrieve_result: Result<RetrieveBtcOk, RetrieveBtcWithApprovalError> =
        retrieve_response.unwrap().candid().map_err(|e| {
            add_available(principal, params.amount);
            VolumetricError::inter_canister_call_failed(&format!(
                "retrieve_btc_with_approval decode: {:?}",
                e
            ))
        })?;

    match retrieve_result {
        Ok(ok) => Ok(WithdrawResult {
            block_index: ok.block_index,
        }),
        Err(_) => {
            add_available(principal, params.amount);
            Err(VolumetricError::inter_canister_call_failed(
                "retrieve_btc_with_approval rejected",
            ))
        }
    }
}

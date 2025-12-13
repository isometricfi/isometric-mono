use candid::{CandidType, Nat};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

use crate::auth::types::{AuthenticatedPayload, SignableAction, WalletKey, WithdrawCkbtcRequest};
use crate::auth::{derive_subaccount, verify_btc_signature};
use crate::errors::VolumetricError;
use crate::generated::ckbtc::{
    RetrieveBtcOk, RetrieveBtcWithApprovalArgs, RetrieveBtcWithApprovalError,
};
use crate::storage::{get_principal_for_wallet, increment_nonce, Config};

use super::accounts::build_challenge_context;

fn get_user_subaccount(address: &str) -> Result<[u8; 32], VolumetricError> {
    let wallet_key = WalletKey::from_address(address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or(VolumetricError::ProfileNotFound)?;
    Ok(derive_subaccount(principal))
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct WithdrawResult {
    pub block_index: u64,
}

#[ic_cdk::query]
pub fn get_withdraw_message(address: String, btc_address: String, amount: u64) -> String {
    let wallet_key = WalletKey::from_address(&address);
    let context = build_challenge_context(&wallet_key);
    let req = WithdrawCkbtcRequest { btc_address, amount };
    req.signing_message(&address, &context)
}

#[ic_cdk::update]
pub async fn withdraw_ckbtc(
    req: AuthenticatedPayload<WithdrawCkbtcRequest>,
) -> Result<WithdrawResult, VolumetricError> {
    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::from_address(address);

    let context = build_challenge_context(&wallet_key);
    let message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let subaccount = get_user_subaccount(address)?;
    let minter = Config::ckbtc_minter();
    let ledger = Config::ckbtc_ledger();

    let approve_args = icrc_ledger_types::icrc2::approve::ApproveArgs {
        from_subaccount: Some(subaccount),
        spender: Account {
            owner: minter,
            subaccount: None,
        },
        amount: Nat::from(req.data.amount),
        expected_allowance: None,
        expires_at: None,
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let approve_response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc2_approve")
        .with_arg(&approve_args)
        .await
        .map_err(|e| VolumetricError::InterCanisterCallFailed(format!("icrc2_approve: {:?}", e)))?;

    let approve_result: Result<Nat, icrc_ledger_types::icrc2::approve::ApproveError> =
        approve_response.candid().map_err(|e| {
            VolumetricError::InterCanisterCallFailed(format!("icrc2_approve decode: {:?}", e))
        })?;

    approve_result.map_err(|e| {
        VolumetricError::InterCanisterCallFailed(format!("icrc2_approve rejected: {:?}", e))
    })?;

    let retrieve_args = RetrieveBtcWithApprovalArgs {
        address: req.data.btc_address,
        amount: req.data.amount,
        from_subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let retrieve_response =
        ic_cdk::call::Call::unbounded_wait(minter, "retrieve_btc_with_approval")
            .with_arg(&retrieve_args)
            .await
            .map_err(|e| {
                VolumetricError::InterCanisterCallFailed(format!(
                    "retrieve_btc_with_approval: {:?}",
                    e
                ))
            })?;

    let retrieve_result: Result<RetrieveBtcOk, RetrieveBtcWithApprovalError> =
        retrieve_response.candid().map_err(|e| {
            VolumetricError::InterCanisterCallFailed(format!(
                "retrieve_btc_with_approval decode: {:?}",
                e
            ))
        })?;

    let ok = retrieve_result.map_err(|_| {
        VolumetricError::InterCanisterCallFailed("retrieve_btc_with_approval rejected".to_string())
    })?;

    Ok(WithdrawResult {
        block_index: ok.block_index,
    })
}

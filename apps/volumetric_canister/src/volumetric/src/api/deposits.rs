use candid::{CandidType, Nat};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

use crate::auth::derive_subaccount;
use crate::auth::types::WalletKey;
use crate::errors::VolumetricError;
use crate::generated::ckbtc::{GetBtcAddressArg, UpdateBalanceArg, UpdateBalanceError, UtxoStatus};
use crate::storage::{get_principal_for_wallet, Config};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DepositInfo {
    pub btc_address: String,
    pub account: Account,
}

fn get_user_subaccount(address: &str) -> Result<[u8; 32], VolumetricError> {
    let wallet_key = WalletKey::from_address(address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;
    Ok(derive_subaccount(principal))
}

fn get_user_account(address: &str) -> Result<Account, VolumetricError> {
    let subaccount = get_user_subaccount(address)?;
    Ok(Account {
        owner: ic_cdk::api::canister_self(),
        subaccount: Some(subaccount),
    })
}

#[ic_cdk::update]
pub async fn get_deposit_address(address: String) -> Result<DepositInfo, VolumetricError> {
    let subaccount = get_user_subaccount(&address)?;
    let minter = Config::ckbtc_minter();

    let args = GetBtcAddressArg {
        owner: Some(ic_cdk::api::canister_self()),
        subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let response = ic_cdk::call::Call::unbounded_wait(minter, "get_btc_address")
        .with_arg(&args)
        .await
        .map_err(|e| VolumetricError::inter_canister_call_failed(&format!("get_btc_address: {:?}", e)))?;

    let btc_address: String = response.candid().map_err(|e| {
        VolumetricError::inter_canister_call_failed(&format!("get_btc_address decode: {:?}", e))
    })?;

    let account = get_user_account(&address)?;
    Ok(DepositInfo {
        btc_address,
        account,
    })
}

#[ic_cdk::update]
pub async fn update_ckbtc_balance(address: String) -> Result<Vec<UtxoStatus>, VolumetricError> {
    let subaccount = get_user_subaccount(&address)?;
    let minter = Config::ckbtc_minter();

    let args = UpdateBalanceArg {
        owner: Some(ic_cdk::api::canister_self()),
        subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let response = ic_cdk::call::Call::unbounded_wait(minter, "update_balance")
        .with_arg(&args)
        .await
        .map_err(|e| VolumetricError::inter_canister_call_failed(&format!("update_balance: {:?}", e)))?;

    let result: Result<Vec<UtxoStatus>, UpdateBalanceError> = response.candid().map_err(|e| {
        VolumetricError::inter_canister_call_failed(&format!("update_balance decode: {:?}", e))
    })?;

    result.map_err(|e| {
        let msg = match e {
            UpdateBalanceError::GenericError { error_message, .. } => error_message,
            UpdateBalanceError::TemporarilyUnavailable(msg) => msg,
            UpdateBalanceError::AlreadyProcessing => "Already processing".to_string(),
            UpdateBalanceError::NoNewUtxos { .. } => "No new UTXOs".to_string(),
        };
        VolumetricError::inter_canister_call_failed(&format!("update_balance: {}", msg))
    })
}

#[ic_cdk::update]
pub async fn get_ckbtc_balance(address: String) -> Result<Nat, VolumetricError> {
    let account = get_user_account(&address)?;
    let ledger = Config::ckbtc_ledger();

    let response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc1_balance_of")
        .with_arg(&account)
        .await
        .map_err(|e| VolumetricError::inter_canister_call_failed(&format!("icrc1_balance_of: {:?}", e)))?;

    let balance: Nat = response.candid().map_err(|e| {
        VolumetricError::inter_canister_call_failed(&format!("icrc1_balance_of decode: {:?}", e))
    })?;

    Ok(balance)
}

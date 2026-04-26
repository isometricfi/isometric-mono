use candid::{CandidType, Nat};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

use crate::auth::types::WalletKey;
use crate::errors::{error_codes, VolumetricError};
use crate::generated::ckbtc::UtxoStatus;
use crate::guards::{is_whitelisted, no_replicated_call};
use crate::storage::get_principal_for_wallet;
use crate::usecases;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DepositInfo {
    pub btc_address: String,
    pub account: Account,
}

impl From<usecases::DepositAddressResult> for DepositInfo {
    fn from(info: usecases::DepositAddressResult) -> Self {
        Self {
            btc_address: info.btc_address,
            account: info.account,
        }
    }
}

#[ic_cdk::update]
pub async fn get_deposit_address(address: String) -> Result<DepositInfo, VolumetricError> {
    is_whitelisted()?;

    let wallet_key = WalletKey::try_from_address(&address)?;
    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    let info = usecases::get_deposit_address(principal).await?;
    Ok(info.into())
}

#[ic_cdk::update]
pub async fn update_ckbtc_balance(address: String) -> Result<Vec<UtxoStatus>, VolumetricError> {
    is_whitelisted()?;

    let wallet_key = WalletKey::try_from_address(&address)?;
    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    usecases::mint_ckbtc_from_utxos(principal).await
}

#[ic_cdk::update]
pub async fn get_ckbtc_balance(address: String) -> Result<Nat, VolumetricError> {
    is_whitelisted()?;

    let wallet_key = WalletKey::try_from_address(&address)?;
    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    usecases::get_ledger_balance(principal).await
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserBalanceInfo {
    pub total: u64,
    pub available: u64,
    pub locked: u64,
}

impl From<usecases::UserBalanceResult> for UserBalanceInfo {
    fn from(result: usecases::UserBalanceResult) -> Self {
        Self {
            total: result.total,
            available: result.available,
            locked: result.locked,
        }
    }
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_user_balance(address: String) -> Result<UserBalanceInfo, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&address)?;
    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    let result = usecases::get_user_balance_use_case(principal)?;
    Ok(result.into())
}

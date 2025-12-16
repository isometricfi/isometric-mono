use candid::{CandidType, Nat};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

use crate::auth::types::WalletKey;
use crate::errors::VolumetricError;
use crate::generated::ckbtc::UtxoStatus;
use crate::guards::is_whitelisted;
use crate::storage::get_principal_for_wallet;
use crate::usecases::deposit_ckbtc;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DepositInfo {
    pub btc_address: String,
    pub account: Account,
}

impl From<deposit_ckbtc::DepositAddressResult> for DepositInfo {
    fn from(info: deposit_ckbtc::DepositAddressResult) -> Self {
        Self {
            btc_address: info.btc_address,
            account: info.account,
        }
    }
}

#[ic_cdk::update]
pub async fn get_deposit_address(address: String) -> Result<DepositInfo, VolumetricError> {
    is_whitelisted().await?;

    let wallet_key = WalletKey::from_address(&address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    let info = deposit_ckbtc::get_deposit_address(principal).await?;
    Ok(info.into())
}

#[ic_cdk::update]
pub async fn update_ckbtc_balance(address: String) -> Result<Vec<UtxoStatus>, VolumetricError> {
    is_whitelisted().await?;

    let wallet_key = WalletKey::from_address(&address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    deposit_ckbtc::mint_ckbtc_from_utxos(principal).await
}

#[ic_cdk::update]
pub async fn get_ckbtc_balance(address: String) -> Result<Nat, VolumetricError> {
    is_whitelisted().await?;

    let wallet_key = WalletKey::from_address(&address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    deposit_ckbtc::get_ledger_balance(principal).await
}

#[ic_cdk::update]
pub async fn testing_sync_balance_from_ledger(address: String) -> Result<u64, VolumetricError> {
    is_whitelisted().await?;

    let wallet_key = WalletKey::from_address(&address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    deposit_ckbtc::sync_balance_from_ledger(principal).await
}

use candid::{CandidType, Nat};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

use crate::auth::types::WalletKey;
use crate::errors::VolumetricError;
use crate::generated::ckbtc::UtxoStatus;
use crate::guards::is_whitelisted;
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
    is_whitelisted().await?;

    let wallet_key = WalletKey::from_address(&address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    let info = usecases::get_deposit_address(principal).await?;
    Ok(info.into())
}

#[ic_cdk::update]
pub async fn update_ckbtc_balance(address: String) -> Result<Vec<UtxoStatus>, VolumetricError> {
    is_whitelisted().await?;

    let wallet_key = WalletKey::from_address(&address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    usecases::mint_ckbtc_from_utxos(principal).await
}

#[ic_cdk::update]
pub async fn get_ckbtc_balance(address: String) -> Result<Nat, VolumetricError> {
    is_whitelisted().await?;

    let wallet_key = WalletKey::from_address(&address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    usecases::get_ledger_balance(principal).await
}

#[ic_cdk::update]
pub async fn testing_sync_balance_from_ledger(address: String) -> Result<u64, VolumetricError> {
    is_whitelisted().await?;

    let wallet_key = WalletKey::from_address(&address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    usecases::sync_balance_from_ledger(principal).await
}

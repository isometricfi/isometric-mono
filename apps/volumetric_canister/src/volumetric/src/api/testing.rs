//! Whitelist-gated canister methods compiled only with `--features testing` (not in production wasm).

use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

use crate::auth::types::WalletKey;
use crate::errors::{error_codes, VolumetricError};
use crate::guards::is_whitelisted;
use crate::storage::{get_principal_for_wallet, ActiveOption};
use crate::usecases;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ClearStorageResponse {
    pub offers_cleared: u64,
    pub options_cleared: u64,
}

#[ic_cdk::update]
pub fn testing_set_oracle_price_cents(price_cents: u64) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    usecases::set_oracle_price_use_case(price_cents);
    Ok(())
}

#[ic_cdk::update]
pub fn testing_reset_oracle() -> Result<(), VolumetricError> {
    is_whitelisted()?;
    usecases::reset_oracle_use_case();
    Ok(())
}

#[ic_cdk::update]
pub fn testing_set_ckbtc_ledger(ledger: Principal) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    usecases::testing_set_ckbtc_ledger_use_case(ledger);
    Ok(())
}

#[ic_cdk::update]
pub async fn testing_sync_balance_from_ledger(address: String) -> Result<u64, VolumetricError> {
    is_whitelisted()?;

    let wallet_key = WalletKey::try_from_address(&address)?;
    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    usecases::sync_balance_from_ledger(principal).await
}

#[ic_cdk::update]
pub fn testing_clear_offers_and_options() -> Result<ClearStorageResponse, VolumetricError> {
    is_whitelisted()?;

    let offers_cleared = crate::storage::clear_offers();
    let options_cleared = crate::storage::clear_active_options();

    Ok(ClearStorageResponse {
        offers_cleared,
        options_cleared,
    })
}

#[ic_cdk::update]
pub fn testing_expire_option(option_id: u64) -> Result<ActiveOption, VolumetricError> {
    is_whitelisted()?;
    usecases::testing_expire_option_use_case(option_id)
}

#[ic_cdk::update]
pub fn testing_set_option_expiry_seconds(
    option_id: u64,
    expiry_seconds: u64,
) -> Result<ActiveOption, VolumetricError> {
    is_whitelisted()?;
    usecases::testing_set_option_expiry_use_case(option_id, expiry_seconds)
}

#[ic_cdk::update]
pub async fn testing_force_settle(
    option_id: u64,
) -> Result<usecases::SettlementReceipt, VolumetricError> {
    is_whitelisted()?;
    usecases::testing_force_settle_option_use_case(option_id).await
}

#[ic_cdk::update]
pub fn testing_reset_stuck_settling_option(option_id: u64) -> Result<ActiveOption, VolumetricError> {
    is_whitelisted()?;
    usecases::testing_reset_stuck_settling_option_use_case(option_id)
}

#[ic_cdk::update]
pub async fn testing_settle_option_with_price(
    option_id: u64,
    price_cents: u64,
) -> Result<usecases::SettlementResult, VolumetricError> {
    is_whitelisted()?;
    usecases::testing_settle_option_with_price_use_case(option_id, price_cents).await
}

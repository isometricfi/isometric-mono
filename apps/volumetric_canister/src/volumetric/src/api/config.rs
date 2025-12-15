use ic_cdk::{query, update};

use crate::errors::VolumetricError;
use crate::guards::is_whitelisted;
use crate::oracle::set_oracle_price_internal;
use crate::storage::{get_platform_fees_collected, Config, PLATFORM_FEE_BASIS_POINTS};

#[query]
pub fn get_config() -> Config {
    Config::get()
}

#[query]
pub fn get_platform_fee_info() -> (u64, u64) {
    (PLATFORM_FEE_BASIS_POINTS, get_platform_fees_collected())
}

#[update]
pub async fn set_temp(value: String) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    Config::set_temp(value);
    Ok(())
}

// Sets the oracle price. Requires whitelisted caller. Price is in cents (e.g., 10000000 = $100,000.00).
// Won't be used in production. Only for testing.
// PROD will use https://internetcomputer.org/docs/references/system-canisters/xrc
// TODO: Add this up next :)
#[update]
pub async fn set_oracle_price(price_cents: u64) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_oracle_price_internal(price_cents);
    Ok(())
}

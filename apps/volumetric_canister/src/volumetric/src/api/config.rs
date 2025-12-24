use ic_cdk::{query, update};

use crate::errors::VolumetricError;
use crate::guards::is_whitelisted;
use crate::storage::{
    get_platform_fees_collected, Config, FeatureFlags, TradingLimits, PLATFORM_FEE_BASIS_POINTS,
};
use crate::usecases;

#[query]
pub fn get_config() -> Config {
    Config::get()
}

#[query]
pub fn get_feature_flags() -> FeatureFlags {
    Config::feature_flags()
}

#[query]
pub fn get_trading_limits() -> TradingLimits {
    Config::trading_limits()
}

#[query]
pub fn get_platform_fee_info() -> (u64, u64) {
    (PLATFORM_FEE_BASIS_POINTS, get_platform_fees_collected())
}

#[update]
pub async fn set_oracle_price(price_cents: u64) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    usecases::set_oracle_price_use_case(price_cents);
    Ok(())
}

#[update]
pub async fn set_feature_flags(flags: FeatureFlags) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    usecases::set_feature_flags_use_case(flags);
    Ok(())
}

#[update]
pub async fn set_trading_limits(limits: TradingLimits) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    usecases::set_trading_limits_use_case(limits);
    Ok(())
}

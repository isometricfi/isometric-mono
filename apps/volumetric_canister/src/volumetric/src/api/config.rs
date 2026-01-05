use ic_cdk::{query, update};

use crate::errors::VolumetricError;
use crate::guards::is_whitelisted;
use crate::storage::{
    get_platform_fees_collected, Config, FeatureFlags, TradingLimits, PLATFORM_FEE_BASIS_POINTS,
};
use crate::usecases::{
    self, set_deposit_amount_sats_use_case, set_max_offers_per_term_use_case,
    set_option_duration_seconds_range_use_case, set_premium_basis_points_range_use_case,
    set_quantity_sats_range_use_case, set_strike_basis_points_range_use_case,
    set_term_days_range_use_case, set_withdraw_amount_sats_use_case,
};

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
pub async fn set_oracle_price_config(price_cents: u64) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    usecases::set_oracle_price_use_case(price_cents);
    Ok(())
}

#[update]
pub async fn set_feature_flags_config(flags: FeatureFlags) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    usecases::set_feature_flags_use_case(flags);
    Ok(())
}

#[update]
pub async fn set_trading_limits_config(limits: TradingLimits) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    usecases::set_trading_limits_use_case(limits);
    Ok(())
}

#[update]
pub async fn set_quantity_sats_range_config(min: u64, max: u64) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_quantity_sats_range_use_case(min, max);
    Ok(())
}

#[update]
pub async fn set_premium_basis_points_range_config(
    min: u16,
    max: u16,
) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_premium_basis_points_range_use_case(min, max);
    Ok(())
}

#[update]
pub async fn set_strike_basis_points_range_config(
    min: u16,
    max: u16,
) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_strike_basis_points_range_use_case(min, max);
    Ok(())
}

#[update]
pub async fn set_option_duration_seconds_range_config(
    min: u64,
    max: u64,
) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_option_duration_seconds_range_use_case(min, max);
    Ok(())
}

#[update]
pub async fn set_term_days_range_config(min: u64, max: u64) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_term_days_range_use_case(min, max);
    Ok(())
}

#[update]
pub async fn set_deposit_amount_sats_config(amount: u64) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_deposit_amount_sats_use_case(amount);
    Ok(())
}

#[update]
pub async fn set_withdraw_amount_sats_config(amount: u64) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_withdraw_amount_sats_use_case(amount);
    Ok(())
}

#[update]
pub async fn set_max_offers_per_term_config(max: usize) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_max_offers_per_term_use_case(max);
    Ok(())
}

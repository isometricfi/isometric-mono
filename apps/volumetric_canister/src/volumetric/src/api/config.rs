use candid::Principal;
use ic_cdk::{query, update};

use crate::errors::VolumetricError;
use crate::guards::is_whitelisted;
use crate::storage::{get_platform_fees_collected, Config, FeatureFlags, FeeConfig, TradingLimits};
use crate::usecases::{
    self, set_deposit_amount_sats_use_case, set_fee_config_use_case, set_fee_recipient_use_case,
    set_max_offers_per_term_use_case, set_option_duration_seconds_range_use_case,
    set_premium_basis_points_range_use_case, set_premium_fee_basis_points_use_case,
    set_profit_fee_basis_points_use_case, set_quantity_sats_range_use_case,
    set_strike_basis_points_range_use_case, set_term_days_range_use_case,
    set_withdraw_amount_sats_use_case,
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
pub fn get_fee_config() -> FeeConfig {
    Config::fee_config()
}

#[query]
pub fn get_platform_fees_collected_total() -> u64 {
    get_platform_fees_collected()
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

#[update]
pub async fn set_fee_config_config(fee_config: FeeConfig) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_fee_config_use_case(fee_config);
    Ok(())
}

#[update]
pub async fn set_premium_fee_basis_points_config(basis_points: u64) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_premium_fee_basis_points_use_case(basis_points);
    Ok(())
}

#[update]
pub async fn set_profit_fee_basis_points_config(basis_points: u64) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_profit_fee_basis_points_use_case(basis_points);
    Ok(())
}

#[update]
pub async fn set_fee_recipient_config(recipient: Principal) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    set_fee_recipient_use_case(recipient);
    Ok(())
}

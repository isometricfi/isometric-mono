use candid::Principal;
use ic_cdk::{query, update};

use crate::errors::VolumetricError;
use crate::guards::{is_controller, is_whitelisted, no_replicated_call};
use crate::storage::{get_platform_fees_collected, Config, FeatureFlags, FeeConfig, TradingLimits};
use crate::usecases;
use crate::usecases::{
    set_accept_offer_quantity_sats_range_use_case, set_create_offer_quantity_sats_range_use_case,
    set_deposit_amount_sats_use_case, set_fee_config_use_case, set_fee_recipient_use_case,
    set_log_access_token_use_case, set_max_offers_per_term_use_case,
    set_option_duration_seconds_range_use_case, set_premium_basis_points_range_use_case,
    set_premium_fee_basis_points_use_case, set_profit_fee_basis_points_use_case,
    set_quantity_sats_range_use_case, set_strike_basis_points_range_use_case,
    set_withdraw_amount_sats_use_case,
};

#[query(guard = "no_replicated_call")]
pub fn get_config() -> Result<Config, VolumetricError> {
    is_whitelisted()?;
    Ok(Config::get())
}

#[query(guard = "no_replicated_call")]
pub fn get_feature_flags() -> FeatureFlags {
    Config::feature_flags()
}

#[query(guard = "no_replicated_call")]
pub fn get_trading_limits() -> TradingLimits {
    Config::trading_limits()
}

#[query(guard = "no_replicated_call")]
pub fn get_fee_config() -> Result<FeeConfig, VolumetricError> {
    is_whitelisted()?;
    Ok(Config::fee_config())
}

#[query(guard = "no_replicated_call")]
pub fn get_platform_fees_collected_total() -> Result<u64, VolumetricError> {
    is_whitelisted()?;
    Ok(get_platform_fees_collected())
}

#[update]
pub fn set_feature_flags_config(flags: FeatureFlags) -> Result<(), VolumetricError> {
    is_controller()?;
    usecases::set_feature_flags_use_case(flags);
    Ok(())
}

#[update]
pub fn set_trading_limits_config(limits: TradingLimits) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    usecases::set_trading_limits_use_case(limits);
    Ok(())
}

#[update]
pub fn set_quantity_sats_range_config(min: u64, max: u64) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_quantity_sats_range_use_case(min, max);
    Ok(())
}

#[update]
pub fn set_create_offer_quantity_sats_range_config(
    min: u64,
    max: u64,
) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_create_offer_quantity_sats_range_use_case(min, max);
    Ok(())
}

#[update]
pub fn set_accept_offer_quantity_sats_range_config(
    min: u64,
    max: u64,
) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_accept_offer_quantity_sats_range_use_case(min, max);
    Ok(())
}

#[update]
pub fn set_premium_basis_points_range_config(min: u16, max: u16) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_premium_basis_points_range_use_case(min, max);
    Ok(())
}

#[update]
pub fn set_strike_basis_points_range_config(min: u16, max: u16) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_strike_basis_points_range_use_case(min, max);
    Ok(())
}

#[update]
pub fn set_option_duration_seconds_range_config(min: u64, max: u64) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_option_duration_seconds_range_use_case(min, max);
    Ok(())
}

#[update]
pub fn set_deposit_amount_sats_config(amount: u64) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_deposit_amount_sats_use_case(amount);
    Ok(())
}

#[update]
pub fn set_withdraw_amount_sats_config(amount: u64) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_withdraw_amount_sats_use_case(amount);
    Ok(())
}

#[update]
pub fn set_max_offers_per_term_config(max: usize) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_max_offers_per_term_use_case(max);
    Ok(())
}

#[update]
pub fn set_fee_config_config(fee_config: FeeConfig) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_fee_config_use_case(fee_config);
    Ok(())
}

#[update]
pub fn set_premium_fee_basis_points_config(basis_points: u64) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_premium_fee_basis_points_use_case(basis_points);
    Ok(())
}

#[update]
pub fn set_profit_fee_basis_points_config(basis_points: u64) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_profit_fee_basis_points_use_case(basis_points);
    Ok(())
}

#[update]
pub fn set_fee_recipient_config(recipient: Principal) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_fee_recipient_use_case(recipient);
    Ok(())
}

#[update]
pub fn set_log_access_token(token: String) -> Result<(), VolumetricError> {
    is_whitelisted()?;
    set_log_access_token_use_case(token)
}

#[update]
pub fn clear_log_access_token() -> Result<(), VolumetricError> {
    is_whitelisted()?;
    usecases::clear_log_access_token_use_case();
    Ok(())
}

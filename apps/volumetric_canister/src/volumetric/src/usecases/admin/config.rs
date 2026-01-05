use crate::oracle::set_oracle_price_internal;
use crate::storage::{Config, FeatureFlags, TradingLimits};

pub fn set_oracle_price_use_case(price_cents: u64) {
    set_oracle_price_internal(price_cents);
}

pub fn set_feature_flags_use_case(flags: FeatureFlags) {
    Config::set_feature_flags(flags);
}

pub fn set_trading_limits_use_case(limits: TradingLimits) {
    Config::set_trading_limits(limits);
}

pub fn set_quantity_sats_range_use_case(min: u64, max: u64) {
    Config::set_quantity_sats_range(min, max);
}

pub fn set_premium_basis_points_range_use_case(min: u16, max: u16) {
    Config::set_premium_basis_points_range(min, max);
}

pub fn set_strike_basis_points_range_use_case(min: u16, max: u16) {
    Config::set_strike_basis_points_range(min, max);
}

pub fn set_option_duration_seconds_range_use_case(min: u64, max: u64) {
    Config::set_option_duration_seconds_range(min, max);
}

pub fn set_term_days_range_use_case(min: u64, max: u64) {
    Config::set_term_days_range(min, max);
}

pub fn set_deposit_amount_sats_use_case(amount: u64) {
    Config::set_deposit_amount_sats(amount);
}

pub fn set_withdraw_amount_sats_use_case(amount: u64) {
    Config::set_withdraw_amount_sats(amount);
}

pub fn set_max_offers_per_term_use_case(max: usize) {
    Config::set_max_offers_per_term(max);
}

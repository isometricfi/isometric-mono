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

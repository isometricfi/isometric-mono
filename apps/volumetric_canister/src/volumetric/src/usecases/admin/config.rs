use crate::oracle::set_oracle_price_internal;
use crate::storage::{Config, FeatureFlags};

pub fn set_oracle_price_use_case(price_cents: u64) {
    set_oracle_price_internal(price_cents);
}

pub fn set_feature_flags_use_case(flags: FeatureFlags) {
    Config::set_feature_flags(flags);
}

use crate::oracle::set_oracle_price_internal;
use crate::storage::Config;

pub fn set_temp_use_case(value: String) {
    Config::set_temp(value);
}

pub fn set_oracle_price_use_case(price_cents: u64) {
    set_oracle_price_internal(price_cents);
}

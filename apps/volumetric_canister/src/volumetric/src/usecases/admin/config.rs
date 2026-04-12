use candid::Principal;

#[cfg(feature = "testing")]
use crate::ledger::TESTING_CKBTC_TRANSFER_FEE_SATS;
#[cfg(feature = "testing")]
use crate::oracle::{reset_oracle_internal, set_oracle_price_internal};
use crate::storage::{Config, FeatureFlags, FeeConfig, TradingLimits};
#[cfg(feature = "testing")]
use crate::{ic, ledger};

#[cfg(feature = "testing")]
pub fn set_oracle_price_use_case(price_cents: u64) {
    set_oracle_price_internal(price_cents);
}

#[cfg(feature = "testing")]
pub fn reset_oracle_use_case() {
    reset_oracle_internal();
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

pub fn set_create_offer_quantity_sats_range_use_case(min: u64, max: u64) {
    Config::set_create_offer_quantity_sats_range(min, max);
}

pub fn set_accept_offer_quantity_sats_range_use_case(min: u64, max: u64) {
    Config::set_accept_offer_quantity_sats_range(min, max);
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

pub fn set_fee_config_use_case(fee_config: FeeConfig) {
    Config::set_fee_config(fee_config);
}

pub fn set_premium_fee_basis_points_use_case(basis_points: u64) {
    Config::set_premium_fee_basis_points(basis_points);
}

pub fn set_profit_fee_basis_points_use_case(basis_points: u64) {
    Config::set_profit_fee_basis_points(basis_points);
}

pub fn set_fee_recipient_use_case(recipient: Principal) {
    Config::set_fee_recipient(recipient);
}

pub fn testing_set_ckbtc_ledger_use_case(ckbtc_ledger: Principal) {
    Config::set_ckbtc_ledger(ckbtc_ledger);

    #[cfg(feature = "testing")]
    ledger::set_cached_transfer_fee_for_testing(TESTING_CKBTC_TRANSFER_FEE_SATS, ic::time());
}

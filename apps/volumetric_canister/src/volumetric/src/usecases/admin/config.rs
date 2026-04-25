use candid::Principal;

use crate::errors::{error_codes, VolumetricError};
#[cfg(feature = "testing")]
use crate::ledger::TESTING_CKBTC_TRANSFER_FEE_SATS;
#[cfg(feature = "testing")]
use crate::oracle::{reset_oracle_internal, set_oracle_price_internal};
use crate::storage::{
    clear_log_access_token_hash, set_log_access_token_hash, Config, FeatureFlags, FeeConfig,
    TradingLimits,
};
#[cfg(feature = "testing")]
use crate::{ic, ledger};

const MIN_LOG_ACCESS_TOKEN_LENGTH: usize = 32;
const MAX_LOG_ACCESS_TOKEN_LENGTH: usize = 4_096;

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

pub fn set_log_access_token_use_case(token: String) -> Result<(), VolumetricError> {
    if token.len() < MIN_LOG_ACCESS_TOKEN_LENGTH {
        return Err(VolumetricError::from_def(
            error_codes::CONFIG_ERROR,
            Some("log access token must be at least 32 characters"),
            None,
        ));
    }

    if token.len() > MAX_LOG_ACCESS_TOKEN_LENGTH {
        return Err(VolumetricError::from_def(
            error_codes::CONFIG_ERROR,
            Some("log access token is too long"),
            None,
        ));
    }

    set_log_access_token_hash(logging::bearer_token_sha256_hex(&token));
    Ok(())
}

pub fn clear_log_access_token_use_case() {
    clear_log_access_token_hash();
}

pub fn testing_set_ckbtc_ledger_use_case(ckbtc_ledger: Principal) {
    Config::set_ckbtc_ledger(ckbtc_ledger);

    #[cfg(feature = "testing")]
    ledger::set_cached_transfer_fee_for_testing(TESTING_CKBTC_TRANSFER_FEE_SATS, ic::time());
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::get_log_access_token_hash;
    use std::sync::Mutex;

    const VALID_LOG_ACCESS_TOKEN: &str = "valid-log-access-token-for-tests-123";
    const SHORT_LOG_ACCESS_TOKEN: &str = "short";
    static LOG_ACCESS_TOKEN_TEST_LOCK: Mutex<()> = Mutex::new(());

    /// Given: a log access token shorter than the minimum length
    /// When: setting the log access token
    /// Then: returns a config error
    #[test]
    fn test_set_log_access_token_rejects_short_token() {
        // given
        let _lock = LOG_ACCESS_TOKEN_TEST_LOCK.lock().unwrap();
        let token = SHORT_LOG_ACCESS_TOKEN.to_string();

        // when
        let result = set_log_access_token_use_case(token);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::CONFIG_ERROR.code);
    }

    /// Given: a valid log access token
    /// When: setting the log access token
    /// Then: stores only the token hash
    #[test]
    fn test_set_log_access_token_stores_hash() {
        // given
        let _lock = LOG_ACCESS_TOKEN_TEST_LOCK.lock().unwrap();
        clear_log_access_token_use_case();
        let token = VALID_LOG_ACCESS_TOKEN.to_string();
        let expected_hash = logging::bearer_token_sha256_hex(VALID_LOG_ACCESS_TOKEN);

        // when
        let result = set_log_access_token_use_case(token);

        // then
        assert!(result.is_ok());
        assert_eq!(get_log_access_token_hash(), Some(expected_hash));
    }

    /// Given: a stored log access token hash
    /// When: clearing the log access token
    /// Then: removes the stored hash
    #[test]
    fn test_clear_log_access_token_removes_hash() {
        // given
        let _lock = LOG_ACCESS_TOKEN_TEST_LOCK.lock().unwrap();
        set_log_access_token_use_case(VALID_LOG_ACCESS_TOKEN.to_string()).unwrap();

        // when
        clear_log_access_token_use_case();

        // then
        assert_eq!(get_log_access_token_hash(), None);
    }
}

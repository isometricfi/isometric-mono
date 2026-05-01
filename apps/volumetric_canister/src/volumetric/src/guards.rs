use candid::Principal;
use ic_cdk::api::{in_replicated_execution, is_controller as api_is_controller, msg_caller};

use crate::errors::{error_codes, VolumetricError};
use crate::storage::{Config, TradingLimits, WHITELIST};

const SECONDS_PER_HOUR: u64 = 3_600;

pub fn is_controller() -> Result<(), VolumetricError> {
    let caller_id = msg_caller();
    ensure_non_anonymous(&caller_id, error_codes::UNAUTHORIZED_CONTROLLER)?;

    if !api_is_controller(&caller_id) {
        return Err(VolumetricError::from_def(
            error_codes::UNAUTHORIZED_CONTROLLER,
            None,
            Some(&caller_id.to_string()),
        ));
    }

    Ok(())
}

pub fn is_whitelisted() -> Result<(), VolumetricError> {
    let caller_id = msg_caller();
    ensure_non_anonymous(&caller_id, error_codes::UNAUTHORIZED_WHITELISTED)?;

    WHITELIST.with_borrow(|whitelist| {
        if !whitelist.contains_key(&caller_id) {
            return Err(VolumetricError::from_def(
                error_codes::UNAUTHORIZED_WHITELISTED,
                None,
                Some(&caller_id.to_string()),
            ));
        }

        Ok(())
    })
}

fn ensure_non_anonymous(
    caller_id: &Principal,
    unauthorized_error: error_codes::ErrorDef,
) -> Result<(), VolumetricError> {
    if caller_id == &Principal::anonymous() {
        return Err(VolumetricError::from_def(
            unauthorized_error,
            Some("anonymous caller not allowed"),
            Some(&caller_id.to_string()),
        ));
    }
    Ok(())
}

pub fn no_replicated_call() -> Result<(), String> {
    if in_replicated_execution() {
        return Err("Not allowed".to_string());
    }
    Ok(())
}

/// Parameters for validating offer trading limits
pub struct OfferParams {
    pub quantity: u64,
    pub strike_basis_points: u16,
    pub premium_basis_points: u16,
    pub option_duration_seconds: u64,
}

/// Validates offer parameters against trading limits.
/// Used by create_offer.
pub fn validate_offer_params(params: &OfferParams) -> Result<TradingLimits, VolumetricError> {
    let limits = Config::trading_limits();

    validate_create_offer_quantity(params.quantity, &limits)?;
    validate_strike_basis_points(params.strike_basis_points, &limits)?;
    validate_premium_basis_points(params.premium_basis_points, &limits)?;
    validate_option_duration(params.option_duration_seconds, &limits)?;

    Ok(limits)
}

/// Validates strike, premium, duration, and accept quantity against trading limits.
pub fn validate_trading_limits_for_accept_offer(
    params: &OfferParams,
) -> Result<TradingLimits, VolumetricError> {
    let limits = Config::trading_limits();

    validate_accept_offer_quantity(params.quantity, &limits)?;
    validate_strike_basis_points(params.strike_basis_points, &limits)?;
    validate_premium_basis_points(params.premium_basis_points, &limits)?;
    validate_option_duration(params.option_duration_seconds, &limits)?;

    Ok(limits)
}

fn validate_create_offer_quantity(
    quantity: u64,
    limits: &TradingLimits,
) -> Result<(), VolumetricError> {
    if quantity < limits.create_offer_quantity_sats.min {
        return Err(VolumetricError::from_def(
            error_codes::QUANTITY_BELOW_MINIMUM,
            Some(&format!(
                "got: {}, minimum: {}",
                quantity, limits.create_offer_quantity_sats.min
            )),
            None,
        ));
    }

    if quantity > limits.create_offer_quantity_sats.max {
        return Err(VolumetricError::from_def(
            error_codes::QUANTITY_ABOVE_MAXIMUM,
            Some(&format!(
                "got: {}, maximum: {}",
                quantity, limits.create_offer_quantity_sats.max
            )),
            None,
        ));
    }

    Ok(())
}

fn validate_accept_offer_quantity(
    quantity: u64,
    limits: &TradingLimits,
) -> Result<(), VolumetricError> {
    if quantity < limits.accept_offer_quantity_sats.min {
        return Err(VolumetricError::from_def(
            error_codes::QUANTITY_BELOW_MINIMUM,
            Some(&format!(
                "got: {}, minimum: {}",
                quantity, limits.accept_offer_quantity_sats.min
            )),
            None,
        ));
    }

    if quantity > limits.accept_offer_quantity_sats.max {
        return Err(VolumetricError::from_def(
            error_codes::QUANTITY_ABOVE_MAXIMUM,
            Some(&format!(
                "got: {}, maximum: {}",
                quantity, limits.accept_offer_quantity_sats.max
            )),
            None,
        ));
    }

    Ok(())
}

fn validate_strike_basis_points(
    strike_basis_points: u16,
    limits: &TradingLimits,
) -> Result<(), VolumetricError> {
    if strike_basis_points < limits.strike_basis_points.min {
        return Err(VolumetricError::from_def(
            error_codes::STRIKE_BELOW_MINIMUM,
            Some(&format!(
                "got: {}, minimum: {}",
                strike_basis_points, limits.strike_basis_points.min
            )),
            None,
        ));
    }

    if strike_basis_points > limits.strike_basis_points.max {
        return Err(VolumetricError::from_def(
            error_codes::STRIKE_ABOVE_MAXIMUM,
            Some(&format!(
                "got: {}, maximum: {}",
                strike_basis_points, limits.strike_basis_points.max
            )),
            None,
        ));
    }

    Ok(())
}

fn validate_premium_basis_points(
    premium_basis_points: u16,
    limits: &TradingLimits,
) -> Result<(), VolumetricError> {
    if premium_basis_points < limits.premium_basis_points.min {
        return Err(VolumetricError::from_def(
            error_codes::PREMIUM_BELOW_MINIMUM,
            Some(&format!(
                "got: {}, minimum: {}",
                premium_basis_points, limits.premium_basis_points.min
            )),
            None,
        ));
    }

    if premium_basis_points > limits.premium_basis_points.max {
        return Err(VolumetricError::from_def(
            error_codes::PREMIUM_ABOVE_MAXIMUM,
            Some(&format!(
                "got: {}, maximum: {}",
                premium_basis_points, limits.premium_basis_points.max
            )),
            None,
        ));
    }

    Ok(())
}

fn validate_option_duration(
    option_duration_seconds: u64,
    limits: &TradingLimits,
) -> Result<(), VolumetricError> {
    if option_duration_seconds < limits.option_duration_seconds.min {
        return Err(VolumetricError::from_def(
            error_codes::DURATION_BELOW_MINIMUM,
            Some(&format!(
                "got: {} seconds, minimum: {} seconds",
                option_duration_seconds, limits.option_duration_seconds.min
            )),
            None,
        ));
    }

    if option_duration_seconds > limits.option_duration_seconds.max {
        return Err(VolumetricError::from_def(
            error_codes::DURATION_ABOVE_MAXIMUM,
            Some(&format!(
                "got: {} seconds, maximum: {} seconds",
                option_duration_seconds, limits.option_duration_seconds.max
            )),
            None,
        ));
    }

    if option_duration_seconds % SECONDS_PER_HOUR != 0 {
        return Err(VolumetricError::from_def(
            error_codes::DURATION_NOT_HOUR_MULTIPLE,
            Some(&format!(
                "got: {} seconds, required multiple: {} seconds",
                option_duration_seconds, SECONDS_PER_HOUR
            )),
            None,
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::errors::error_codes;
    use crate::storage::Range;

    const MIN_QUANTITY_SATS: u64 = 90_000;
    const MAX_QUANTITY_SATS: u64 = 100_000_000;
    const MIN_PREMIUM_BPS: u16 = 10;
    const MAX_PREMIUM_BPS: u16 = 300;
    const MIN_STRIKE_BPS: u16 = 300;
    const MAX_STRIKE_BPS: u16 = 800;
    const SECONDS_PER_HOUR: u64 = 3_600;
    const MIN_DURATION_SECS: u64 = 86400 * 3;
    const SECONDS_PER_DAY: u64 = 86400;
    const MAX_DURATION_DAYS: u64 = 7;
    const MAX_DURATION_SECS: u64 = SECONDS_PER_DAY * MAX_DURATION_DAYS;

    fn test_limits() -> TradingLimits {
        TradingLimits {
            create_offer_quantity_sats: Range {
                min: MIN_QUANTITY_SATS,
                max: MAX_QUANTITY_SATS,
            },
            accept_offer_quantity_sats: Range {
                min: 10_000,
                max: MAX_QUANTITY_SATS,
            },
            premium_basis_points: Range {
                min: MIN_PREMIUM_BPS,
                max: MAX_PREMIUM_BPS,
            },
            strike_basis_points: Range {
                min: MIN_STRIKE_BPS,
                max: MAX_STRIKE_BPS,
            },
            option_duration_seconds: Range {
                min: MIN_DURATION_SECS,
                max: MAX_DURATION_SECS,
            },
            deposit_amount_sats: 50_000,
            withdraw_amount_sats: 50_000,
            max_offers_per_term: 5,
        }
    }

    #[test]
    fn test_ensure_non_anonymous_rejects_anonymous_caller() {
        // given
        let anonymous_caller = Principal::anonymous();

        // when
        let result = ensure_non_anonymous(&anonymous_caller, error_codes::UNAUTHORIZED_WHITELISTED);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::UNAUTHORIZED_WHITELISTED.code);
    }

    #[test]
    fn test_ensure_non_anonymous_allows_authenticated_caller() {
        // given
        let authenticated_caller = Principal::from_slice(&[1; 29]);

        // when
        let result =
            ensure_non_anonymous(&authenticated_caller, error_codes::UNAUTHORIZED_CONTROLLER);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_quantity_at_minimum() {
        // given
        let limits = test_limits();
        let quantity = limits.create_offer_quantity_sats.min;

        // when
        let result = validate_create_offer_quantity(quantity, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_quantity_at_maximum() {
        // given
        let limits = test_limits();
        let quantity = limits.create_offer_quantity_sats.max;

        // when
        let result = validate_create_offer_quantity(quantity, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_quantity_in_range() {
        // given
        let limits = test_limits();
        let quantity = 1_000_000;

        // when
        let result = validate_create_offer_quantity(quantity, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_quantity_below_minimum() {
        // given
        let limits = test_limits();
        let quantity = limits.create_offer_quantity_sats.min - 1;

        // when
        let result = validate_create_offer_quantity(quantity, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::QUANTITY_BELOW_MINIMUM.code);
    }

    #[test]
    fn test_validate_quantity_above_maximum() {
        // given
        let limits = test_limits();
        let quantity = limits.create_offer_quantity_sats.max + 1;

        // when
        let result = validate_create_offer_quantity(quantity, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::QUANTITY_ABOVE_MAXIMUM.code);
    }

    #[test]
    fn test_validate_accept_quantity_at_minimum() {
        // given
        let limits = test_limits();
        let quantity = limits.accept_offer_quantity_sats.min;

        // when
        let result = validate_accept_offer_quantity(quantity, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_accept_quantity_below_minimum() {
        // given
        let limits = test_limits();
        let quantity = limits.accept_offer_quantity_sats.min - 1;

        // when
        let result = validate_accept_offer_quantity(quantity, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::QUANTITY_BELOW_MINIMUM.code);
    }

    #[test]
    fn test_validate_strike_at_minimum() {
        // given
        let limits = test_limits();
        let strike = limits.strike_basis_points.min;

        // when
        let result = validate_strike_basis_points(strike, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_strike_at_maximum() {
        // given
        let limits = test_limits();
        let strike = limits.strike_basis_points.max;

        // when
        let result = validate_strike_basis_points(strike, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_strike_below_minimum() {
        // given
        let limits = test_limits();
        let strike = limits.strike_basis_points.min - 1;

        // when
        let result = validate_strike_basis_points(strike, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::STRIKE_BELOW_MINIMUM.code);
    }

    #[test]
    fn test_validate_strike_above_maximum() {
        // given
        let limits = test_limits();
        let strike = limits.strike_basis_points.max + 1;

        // when
        let result = validate_strike_basis_points(strike, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::STRIKE_ABOVE_MAXIMUM.code);
    }

    #[test]
    fn test_validate_premium_at_minimum() {
        // given
        let limits = test_limits();
        let premium = limits.premium_basis_points.min;

        // when
        let result = validate_premium_basis_points(premium, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_premium_at_maximum() {
        // given
        let limits = test_limits();
        let premium = limits.premium_basis_points.max;

        // when
        let result = validate_premium_basis_points(premium, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_premium_below_minimum() {
        // given
        let limits = test_limits();
        let premium = limits.premium_basis_points.min - 1;

        // when
        let result = validate_premium_basis_points(premium, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::PREMIUM_BELOW_MINIMUM.code);
    }

    #[test]
    fn test_validate_premium_above_maximum() {
        // given
        let limits = test_limits();
        let premium = limits.premium_basis_points.max + 1;

        // when
        let result = validate_premium_basis_points(premium, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::PREMIUM_ABOVE_MAXIMUM.code);
    }

    #[test]
    fn test_validate_duration_at_minimum() {
        // given
        let limits = test_limits();
        let duration = limits.option_duration_seconds.min;

        // when
        let result = validate_option_duration(duration, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_duration_at_maximum() {
        // given
        let limits = test_limits();
        let duration = limits.option_duration_seconds.max;

        // when
        let result = validate_option_duration(duration, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_duration_three_days() {
        // given
        let limits = test_limits();
        let duration = SECONDS_PER_DAY * 3;

        // when
        let result = validate_option_duration(duration, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_duration_rejects_non_hour_multiple() {
        // given
        let limits = test_limits();
        let duration = MIN_DURATION_SECS + 60;

        // when
        let result = validate_option_duration(duration, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::DURATION_NOT_HOUR_MULTIPLE.code);
    }

    #[test]
    fn test_validate_duration_below_minimum() {
        // given
        let limits = test_limits();
        let duration = limits.option_duration_seconds.min - 1;

        // when
        let result = validate_option_duration(duration, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::DURATION_BELOW_MINIMUM.code);
    }

    #[test]
    fn test_validate_duration_above_maximum() {
        // given
        let limits = test_limits();
        let duration = limits.option_duration_seconds.max + 1;

        // when
        let result = validate_option_duration(duration, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::DURATION_ABOVE_MAXIMUM.code);
    }
}

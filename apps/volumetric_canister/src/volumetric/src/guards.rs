use ic_cdk::api::{in_replicated_execution, is_controller as api_is_controller, msg_caller};

use crate::errors::VolumetricError;
use crate::storage::{Config, TradingLimits, WHITELIST};

pub async fn is_controller() -> Result<(), VolumetricError> {
    let caller_id = msg_caller();

    if !api_is_controller(&caller_id) {
        return Err(VolumetricError::unauthorized_controller(
            &caller_id.to_string(),
        ));
    }

    Ok(())
}

pub async fn is_whitelisted() -> Result<(), VolumetricError> {
    let caller_id = msg_caller();

    WHITELIST.with_borrow(|whitelist| {
        if !whitelist.contains_key(&caller_id) {
            return Err(VolumetricError::unauthorized_whitelisted(
                &caller_id.to_string(),
            ));
        }

        Ok(())
    })
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
/// Used by both create_offer and accept_offers flows.
pub fn validate_offer_params(params: &OfferParams) -> Result<TradingLimits, VolumetricError> {
    let limits = Config::trading_limits();

    validate_quantity(params.quantity, &limits)?;
    validate_strike_basis_points(params.strike_basis_points, &limits)?;
    validate_premium_basis_points(params.premium_basis_points, &limits)?;
    validate_option_duration(params.option_duration_seconds, &limits)?;

    Ok(limits)
}

/// Validates only quantity against trading limits.
/// Used when accepting offers where other params come from an existing offer.
pub fn validate_quantity_only(quantity: u64) -> Result<TradingLimits, VolumetricError> {
    let limits = Config::trading_limits();
    validate_quantity(quantity, &limits)?;
    Ok(limits)
}

fn validate_quantity(quantity: u64, limits: &TradingLimits) -> Result<(), VolumetricError> {
    if quantity < limits.quantity_sats.min {
        return Err(VolumetricError::quantity_below_minimum(
            quantity,
            limits.quantity_sats.min,
        ));
    }

    if quantity > limits.quantity_sats.max {
        return Err(VolumetricError::quantity_above_maximum(
            quantity,
            limits.quantity_sats.max,
        ));
    }

    Ok(())
}

fn validate_strike_basis_points(
    strike_basis_points: u16,
    limits: &TradingLimits,
) -> Result<(), VolumetricError> {
    if strike_basis_points < limits.strike_basis_points.min {
        return Err(VolumetricError::strike_below_minimum(
            strike_basis_points,
            limits.strike_basis_points.min,
        ));
    }

    if strike_basis_points > limits.strike_basis_points.max {
        return Err(VolumetricError::strike_above_maximum(
            strike_basis_points,
            limits.strike_basis_points.max,
        ));
    }

    Ok(())
}

fn validate_premium_basis_points(
    premium_basis_points: u16,
    limits: &TradingLimits,
) -> Result<(), VolumetricError> {
    if premium_basis_points < limits.premium_basis_points.min {
        return Err(VolumetricError::premium_below_minimum(
            premium_basis_points,
            limits.premium_basis_points.min,
        ));
    }

    if premium_basis_points > limits.premium_basis_points.max {
        return Err(VolumetricError::premium_above_maximum(
            premium_basis_points,
            limits.premium_basis_points.max,
        ));
    }

    Ok(())
}

fn validate_option_duration(
    option_duration_seconds: u64,
    limits: &TradingLimits,
) -> Result<(), VolumetricError> {
    if option_duration_seconds < limits.option_duration_seconds.min {
        return Err(VolumetricError::duration_below_minimum(
            option_duration_seconds,
            limits.option_duration_seconds.min,
        ));
    }

    if option_duration_seconds > limits.option_duration_seconds.max {
        return Err(VolumetricError::duration_above_maximum(
            option_duration_seconds,
            limits.option_duration_seconds.max,
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
    const MIN_PREMIUM_BPS: u16 = 50;
    const MAX_PREMIUM_BPS: u16 = 10_000;
    const MIN_STRIKE_BPS: u16 = 500;
    const MAX_STRIKE_BPS: u16 = 10_000;
    const MIN_DURATION_SECS: u64 = 60;
    const SECONDS_PER_DAY: u64 = 86400;
    const MAX_DURATION_DAYS: u64 = 30;
    const MAX_DURATION_SECS: u64 = SECONDS_PER_DAY * MAX_DURATION_DAYS;

    fn test_limits() -> TradingLimits {
        TradingLimits {
            quantity_sats: Range {
                min: MIN_QUANTITY_SATS,
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
            term_days: Range { min: 1, max: 30 },
            deposit_amount_sats: 50_000,
            withdraw_amount_sats: 50_000,
        }
    }

    #[test]
    fn test_validate_quantity_at_minimum() {
        // given
        let limits = test_limits();
        let quantity = limits.quantity_sats.min;

        // when
        let result = validate_quantity(quantity, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_quantity_at_maximum() {
        // given
        let limits = test_limits();
        let quantity = limits.quantity_sats.max;

        // when
        let result = validate_quantity(quantity, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_quantity_in_range() {
        // given
        let limits = test_limits();
        let quantity = 1_000_000;

        // when
        let result = validate_quantity(quantity, &limits);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_quantity_below_minimum() {
        // given
        let limits = test_limits();
        let quantity = limits.quantity_sats.min - 1;

        // when
        let result = validate_quantity(quantity, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::QUANTITY_BELOW_MINIMUM.code);
    }

    #[test]
    fn test_validate_quantity_above_maximum() {
        // given
        let limits = test_limits();
        let quantity = limits.quantity_sats.max + 1;

        // when
        let result = validate_quantity(quantity, &limits);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::QUANTITY_ABOVE_MAXIMUM.code);
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
    fn test_validate_duration_one_day() {
        // given
        let limits = test_limits();
        let duration = SECONDS_PER_DAY;

        // when
        let result = validate_option_duration(duration, &limits);

        // then
        assert!(result.is_ok());
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

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

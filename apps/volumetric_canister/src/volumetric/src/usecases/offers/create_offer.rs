use candid::Principal;

use crate::errors::VolumetricError;
use crate::storage::{
    get_balance, insert_offer, next_id, Asset, CounterKey, Offer, OfferStatus, OptionType,
    MINIMUM_QUANTITY_SATS,
};

const MAX_PREMIUM_BASIS_POINTS: u16 = 10_000;
const MIN_OPTION_DURATION_SECONDS: u64 = 60;

pub struct CreateOfferParams {
    pub asset: Asset,
    pub option_type: OptionType,
    pub strike_price_cents: u64,
    pub premium_basis_points: u16,
    pub quantity: u64,
    pub offer_valid_until: u64,
    pub option_duration_seconds: u64,
}

pub fn create_offer(writer: Principal, params: CreateOfferParams) -> Result<Offer, VolumetricError> {
    if params.quantity < MINIMUM_QUANTITY_SATS {
        return Err(VolumetricError::quantity_below_minimum(
            params.quantity,
            MINIMUM_QUANTITY_SATS,
        ));
    }

    if params.strike_price_cents == 0 {
        return Err(VolumetricError::internal(
            "Strike price must be greater than 0",
        ));
    }

    if params.premium_basis_points > MAX_PREMIUM_BASIS_POINTS {
        return Err(VolumetricError::internal(
            "Premium basis points cannot exceed 10000 (100%)",
        ));
    }

    let now = ic_cdk::api::time();

    if params.offer_valid_until <= now {
        return Err(VolumetricError::internal(
            "Offer valid_until must be in the future",
        ));
    }

    if params.option_duration_seconds < MIN_OPTION_DURATION_SECONDS {
        return Err(VolumetricError::internal(
            "Option duration must be at least 60 seconds",
        ));
    }

    let balance = get_balance(&writer);
    if balance.available < params.quantity {
        return Err(VolumetricError::insufficient_balance(
            balance.available,
            params.quantity,
        ));
    }

    let offer_id = next_id(CounterKey::OfferId);

    let offer = Offer {
        id: offer_id,
        writer,
        asset: params.asset,
        option_type: params.option_type,
        strike_price_cents: params.strike_price_cents,
        premium_basis_points: params.premium_basis_points,
        total_quantity: params.quantity,
        remaining_quantity: params.quantity,
        offer_valid_until: params.offer_valid_until,
        option_duration_seconds: params.option_duration_seconds,
        status: OfferStatus::Open,
        created_at: now,
    };

    insert_offer(offer.clone());

    Ok(offer)
}

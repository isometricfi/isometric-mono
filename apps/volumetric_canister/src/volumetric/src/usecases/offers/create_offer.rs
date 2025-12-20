use candid::Principal;

use crate::errors::VolumetricError;
use crate::guards::{validate_offer_params, OfferParams};
use crate::storage::{
    get_balance, insert_offer, next_id, Asset, CounterKey, Offer, OfferStatus, OptionType,
};

pub struct CreateOfferParams {
    pub asset: Asset,
    pub option_type: OptionType,
    pub strike_basis_points: u16,
    pub premium_basis_points: u16,
    pub quantity: u64,
    pub offer_valid_until: u64,
    pub option_duration_seconds: u64,
}

pub fn create_offer_use_case(
    writer: Principal,
    params: CreateOfferParams,
) -> Result<Offer, VolumetricError> {
    validate_offer_params(&OfferParams {
        quantity: params.quantity,
        strike_basis_points: params.strike_basis_points,
        premium_basis_points: params.premium_basis_points,
        option_duration_seconds: params.option_duration_seconds,
    })?;

    let now = ic_cdk::api::time();

    if params.offer_valid_until <= now {
        return Err(VolumetricError::internal(
            "Offer valid_until must be in the future",
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
        strike_basis_points: params.strike_basis_points,
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

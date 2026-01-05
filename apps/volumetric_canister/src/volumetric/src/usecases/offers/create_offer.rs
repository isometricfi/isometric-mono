use candid::Principal;

use crate::errors::VolumetricError;
use crate::guards::{validate_offer_params, OfferParams};
use crate::storage::{
    emit_event, get_balance, insert_offer, list_offers_by_writer, next_id, Asset, CounterKey,
    EventData, EventType, Offer, OfferStatus, OptionType,
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

const MAX_OFFERS_PER_TERM: usize = 5;

fn validate_offer_limit_per_term(
    writer: Principal,
    strike_basis_points: u16,
    option_duration_seconds: u64,
) -> Result<(), VolumetricError> {
    let existing_offers = list_offers_by_writer(writer);

    let count = existing_offers
        .iter()
        .filter(|offer| {
            // Count both open and partially filled offers (still active from writer's perspective)
            matches!(
                offer.status,
                OfferStatus::Open | OfferStatus::PartiallyFilled
            ) && offer.strike_basis_points == strike_basis_points
                && offer.option_duration_seconds == option_duration_seconds
        })
        .count();

    if count >= MAX_OFFERS_PER_TERM {
        return Err(VolumetricError::offer_limit_exceeded(
            count,
            MAX_OFFERS_PER_TERM,
        ));
    }

    Ok(())
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

    validate_offer_limit_per_term(
        writer,
        params.strike_basis_points,
        params.option_duration_seconds,
    )?;

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

    emit_event(
        writer,
        EventType::OfferCreated,
        EventData::OfferCreated {
            offer_id,
            quantity_sats: params.quantity,
            strike_basis_points: params.strike_basis_points,
            premium_basis_points: params.premium_basis_points,
            duration_seconds: params.option_duration_seconds,
            offer_valid_until_ns: params.offer_valid_until,
        },
    );

    Ok(offer)
}

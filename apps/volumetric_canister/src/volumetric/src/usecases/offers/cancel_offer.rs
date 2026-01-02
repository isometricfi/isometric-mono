use candid::Principal;

use crate::errors::VolumetricError;
use crate::storage::{
    emit_event, get_offer, update_offer, EventData, EventType, Offer, OfferStatus,
};

pub fn cancel_offer_use_case(writer: Principal, offer_id: u64) -> Result<Offer, VolumetricError> {
    let mut offer =
        get_offer(offer_id).ok_or_else(|| VolumetricError::offer_not_found(offer_id))?;

    if offer.writer != writer {
        return Err(VolumetricError::not_offer_owner());
    }

    if offer.status == OfferStatus::Cancelled {
        return Err(VolumetricError::offer_cancelled());
    }

    if offer.status == OfferStatus::Filled {
        return Err(VolumetricError::offer_filled());
    }

    offer.status = OfferStatus::Cancelled;
    update_offer(offer.clone());

    emit_event(
        writer,
        EventType::OfferCancelled,
        EventData::OfferCancelled {
            offer_id,
            remaining_quantity_sats: offer.remaining_quantity,
        },
    );

    Ok(offer)
}

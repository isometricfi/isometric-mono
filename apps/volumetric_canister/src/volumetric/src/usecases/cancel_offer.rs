use candid::Principal;

use crate::errors::VolumetricError;
use crate::storage::{get_offer, update_offer, Offer, OfferStatus};

pub fn cancel_offer(writer: Principal, offer_id: u64) -> Result<Offer, VolumetricError> {
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

    Ok(offer)
}

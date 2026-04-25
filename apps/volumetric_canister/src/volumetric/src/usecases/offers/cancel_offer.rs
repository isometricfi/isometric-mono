use candid::Principal;

use crate::errors::{error_codes, VolumetricError};
use crate::storage::{
    emit_event, get_offer, update_offer, EventData, EventType, Offer, OfferStatus,
};

pub fn cancel_offer_use_case(writer: Principal, offer_id: u64) -> Result<Offer, VolumetricError> {
    let mut offer = get_offer(offer_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::OFFER_NOT_FOUND,
            Some(&format!("id: {}", offer_id)),
            None,
        )
    })?;

    if offer.writer != writer {
        return Err(VolumetricError::from_def(
            error_codes::NOT_OFFER_OWNER,
            None,
            None,
        ));
    }

    if !is_offer_status_cancellable(offer.status) {
        return Err(VolumetricError::from_def(
            error_codes::INVALID_OFFER_STATE,
            Some(&format!(
                "cannot cancel offer with status: {:?}",
                offer.status
            )),
            None,
        ));
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

fn is_offer_status_cancellable(status: OfferStatus) -> bool {
    matches!(status, OfferStatus::Open | OfferStatus::PartiallyFilled)
}

#[cfg(test)]
mod tests {
    use candid::Principal;

    use super::*;
    use crate::errors::error_codes;
    use crate::ic;
    use crate::ic::IcRuntime;
    use crate::storage::{clear_events, clear_offers, get_offer, insert_offer, Asset, OptionType};

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const TEST_NOW_SECONDS: u64 = TEST_NOW_NS / crate::time::NANOS_PER_SECOND;
    const TEST_OFFER_ID: u64 = 1;
    const TEST_QUANTITY_SATS: u64 = 1_000_000;
    const TEST_STRIKE_BPS: u16 = 500;
    const TEST_PREMIUM_BPS: u16 = 100;
    const TEST_DURATION_SECS: u64 = 3_600;
    const TEST_OFFER_VALID_FOR_NS: u64 = 60_000_000_000;
    const TEST_OFFER_VALID_FOR_SECONDS: u64 =
        TEST_OFFER_VALID_FOR_NS / crate::time::NANOS_PER_SECOND;

    struct MockRuntime {
        now: u64,
    }

    impl IcRuntime for MockRuntime {
        fn time(&self) -> u64 {
            self.now
        }

        fn canister_self(&self) -> Principal {
            Principal::anonymous()
        }

        fn log(&self, _message: &str) {}
    }

    fn test_principal(seed: u8) -> Principal {
        Principal::from_slice(&[seed; 29])
    }

    fn setup_runtime() {
        ic::set_runtime(Box::new(MockRuntime { now: TEST_NOW_NS }));
    }

    fn build_test_offer(writer: Principal, status: OfferStatus) -> Offer {
        Offer {
            id: TEST_OFFER_ID,
            writer,
            asset: Asset::CkBtc,
            option_type: OptionType::Call,
            strike_basis_points: TEST_STRIKE_BPS,
            premium_basis_points: TEST_PREMIUM_BPS,
            total_quantity: TEST_QUANTITY_SATS,
            remaining_quantity: TEST_QUANTITY_SATS,
            offer_valid_until_seconds: TEST_NOW_SECONDS + TEST_OFFER_VALID_FOR_SECONDS,
            option_duration_seconds: TEST_DURATION_SECS,
            status,
            created_at_seconds: TEST_NOW_SECONDS,
        }
    }

    /// Given: an offer is in a state that is not allowed for cancellation
    /// When: cancelling the offer
    /// Then: the request is rejected with the generic invalid-offer-state error
    #[test]
    fn test_cancel_offer_rejects_disallowed_statuses() {
        // given
        setup_runtime();
        clear_offers();
        clear_events();

        let writer = test_principal(11);
        let disallowed_statuses = [
            OfferStatus::Cancelled,
            OfferStatus::Filled,
            OfferStatus::Processing,
        ];

        for disallowed_status in disallowed_statuses {
            insert_offer(build_test_offer(writer, disallowed_status));

            // when
            let error = cancel_offer_use_case(writer, TEST_OFFER_ID)
                .expect_err("disallowed status should be rejected");

            // then
            assert_eq!(error.code, error_codes::INVALID_OFFER_STATE.code);
            assert!(error.message.contains(&format!("{:?}", disallowed_status)));

            clear_offers();
        }
    }

    /// Given: an offer is partially filled but still active
    /// When: cancelling the offer
    /// Then: the offer is cancelled successfully
    #[test]
    fn test_cancel_offer_allows_partially_filled_status() {
        // given
        setup_runtime();
        clear_offers();
        clear_events();

        let writer = test_principal(22);
        insert_offer(build_test_offer(writer, OfferStatus::PartiallyFilled));

        // when
        let cancelled_offer = cancel_offer_use_case(writer, TEST_OFFER_ID)
            .expect("partially filled offer can cancel");

        // then
        assert_eq!(cancelled_offer.status, OfferStatus::Cancelled);

        let stored_offer = get_offer(TEST_OFFER_ID).expect("offer should still exist");
        assert_eq!(stored_offer.status, OfferStatus::Cancelled);
    }
}

use candid::Principal;

use crate::errors::{error_codes, VolumetricError};
use crate::guards::{validate_offer_params, OfferParams};
use crate::storage::{
    emit_event, get_balance, insert_offer, list_offers_by_writer, next_id, Asset, Config,
    CounterKey, EventData, EventType, Offer, OfferStatus, OptionType,
};
use crate::time::current_time_seconds;

pub struct CreateOfferParams {
    pub asset: Asset,
    pub option_type: OptionType,
    pub strike_basis_points: u16,
    pub premium_basis_points: u16,
    pub quantity: u64,
    pub offer_valid_until_seconds: u64,
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

    validate_offer_limit_per_term(
        writer,
        params.strike_basis_points,
        params.option_duration_seconds,
    )?;

    let now_seconds = current_time_seconds();

    if params.offer_valid_until_seconds <= now_seconds {
        return Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("Offer valid_until must be in the future"),
            None,
        ));
    }

    let balance = get_balance(&writer);
    if balance.available < params.quantity {
        return Err(VolumetricError::from_def(
            error_codes::INSUFFICIENT_BALANCE,
            Some(&format!(
                "available: {}, required: {}",
                balance.available, params.quantity
            )),
            None,
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
        offer_valid_until_seconds: params.offer_valid_until_seconds,
        option_duration_seconds: params.option_duration_seconds,
        status: OfferStatus::Open,
        created_at_seconds: now_seconds,
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
            offer_valid_until_seconds: params.offer_valid_until_seconds,
        },
    );

    logging::log!(
        "offer created id={} writer={} quantity_sats={}",
        offer.id,
        writer,
        params.quantity
    );

    Ok(offer)
}

fn validate_offer_limit_per_term(
    writer: Principal,
    strike_basis_points: u16,
    option_duration_seconds: u64,
) -> Result<(), VolumetricError> {
    let existing_offers = list_offers_by_writer(writer);
    let max_offers_per_term = Config::trading_limits().max_offers_per_term;

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

    if count >= max_offers_per_term {
        return Err(VolumetricError::from_def(
            error_codes::OFFER_LIMIT_EXCEEDED,
            Some(&format!(
                "you have {} active offers (max {})",
                count, max_offers_per_term
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
    use crate::ic::{self, IcRuntime};
    use crate::storage::{add_available, get_offer};

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const VALID_QUANTITY_SATS: u64 = 1_000_000;
    const VALID_STRIKE_BPS: u16 = 5_000;
    const VALID_PREMIUM_BPS: u16 = 500;
    const VALID_DURATION_SECS: u64 = 3600;
    const TEST_NOW_SECONDS: u64 = TEST_NOW_NS / crate::time::NANOS_PER_SECOND;
    const OFFER_VALID_UNTIL_SECONDS: u64 = TEST_NOW_SECONDS + 60;

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
        fn log(&self, _msg: &str) {}
    }

    fn setup_runtime() {
        ic::set_runtime(Box::new(MockRuntime { now: TEST_NOW_NS }));
    }

    fn test_writer() -> Principal {
        Principal::from_slice(&[1; 29])
    }

    fn valid_params() -> CreateOfferParams {
        CreateOfferParams {
            asset: Asset::CkBtc,
            option_type: OptionType::Call,
            strike_basis_points: VALID_STRIKE_BPS,
            premium_basis_points: VALID_PREMIUM_BPS,
            quantity: VALID_QUANTITY_SATS,
            offer_valid_until_seconds: OFFER_VALID_UNTIL_SECONDS,
            option_duration_seconds: VALID_DURATION_SECS,
        }
    }

    #[test]
    fn test_create_offer_succeeds() {
        // given
        setup_runtime();
        let writer = test_writer();
        add_available(writer, VALID_QUANTITY_SATS);
        let params = valid_params();

        // when
        let result = create_offer_use_case(writer, params);

        // then
        assert!(result.is_ok());
        let offer = result.unwrap();
        assert_eq!(offer.writer, writer);
        assert_eq!(offer.total_quantity, VALID_QUANTITY_SATS);
        assert_eq!(offer.remaining_quantity, VALID_QUANTITY_SATS);
        assert_eq!(offer.status, OfferStatus::Open);
        assert_eq!(offer.created_at_seconds, TEST_NOW_SECONDS);
        assert!(get_offer(offer.id).is_some());
    }

    #[test]
    fn test_create_offer_rejects_past_valid_until() {
        // given
        setup_runtime();
        let writer = test_writer();
        add_available(writer, VALID_QUANTITY_SATS);
        let past_valid_until = TEST_NOW_SECONDS - 1;
        let params = CreateOfferParams {
            offer_valid_until_seconds: past_valid_until,
            ..valid_params()
        };

        // when
        let result = create_offer_use_case(writer, params);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::INTERNAL_ERROR.code);
    }

    #[test]
    fn test_create_offer_rejects_valid_until_equal_to_now() {
        // given
        setup_runtime();
        let writer = test_writer();
        add_available(writer, VALID_QUANTITY_SATS);
        let params = CreateOfferParams {
            offer_valid_until_seconds: TEST_NOW_SECONDS,
            ..valid_params()
        };

        // when
        let result = create_offer_use_case(writer, params);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::INTERNAL_ERROR.code);
    }

    #[test]
    fn test_create_offer_rejects_insufficient_balance() {
        // given
        setup_runtime();
        let writer = test_writer();
        let insufficient_balance = VALID_QUANTITY_SATS - 1;
        add_available(writer, insufficient_balance);
        let params = valid_params();

        // when
        let result = create_offer_use_case(writer, params);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::INSUFFICIENT_BALANCE.code);
    }

    #[test]
    fn test_create_offer_rejects_zero_balance() {
        // given
        setup_runtime();
        let writer = test_writer();
        let params = valid_params();

        // when
        let result = create_offer_use_case(writer, params);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::INSUFFICIENT_BALANCE.code);
    }

    #[test]
    fn test_create_offer_rejects_quantity_below_minimum() {
        // given
        setup_runtime();
        let writer = test_writer();
        let below_min_quantity = 1_000;
        add_available(writer, below_min_quantity);
        let params = CreateOfferParams {
            quantity: below_min_quantity,
            ..valid_params()
        };

        // when
        let result = create_offer_use_case(writer, params);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::QUANTITY_BELOW_MINIMUM.code);
    }
}

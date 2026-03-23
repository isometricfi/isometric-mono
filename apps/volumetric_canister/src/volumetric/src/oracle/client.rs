use std::cell::RefCell;
use std::rc::Rc;

use async_trait::async_trait;
use candid::Principal;

use crate::errors::{error_codes, VolumetricError};
use crate::generated::xrc::{
    Asset, AssetClass, ExchangeRateError, GetExchangeRateRequest, GetExchangeRateResult,
};
use crate::ic;

const XRC_CANISTER_ID: &str = "uf6dk-hyaaa-aaaaq-qaaaq-cai";
const XRC_CYCLES: u128 = 1_000_000_000;
const NANOS_PER_SECOND: u64 = 1_000_000_000;
const SECONDS_PER_HOUR: u64 = 3_600;
const CENTS_DECIMALS: u32 = 2;

#[async_trait(?Send)]
pub trait PriceOracle {
    async fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError>;
}

fn round_to_hour_secs(time_nanos: u64) -> u64 {
    let secs = time_nanos / NANOS_PER_SECOND;
    (secs / SECONDS_PER_HOUR) * SECONDS_PER_HOUR
}

fn rate_to_cents(rate: u64, decimals: u32) -> Result<u64, VolumetricError> {
    if decimals < CENTS_DECIMALS {
        return Err(VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some("XRC decimals too low to convert to cents"),
            None,
        ));
    }
    let exponent = decimals - CENTS_DECIMALS;
    let divisor = 10u64.checked_pow(exponent).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some("XRC decimals too high, divisor overflow"),
            None,
        )
    })?;
    Ok(rate / divisor)
}

fn format_xrc_error(e: &ExchangeRateError) -> String {
    match e {
        ExchangeRateError::AnonymousPrincipalNotAllowed => {
            "anonymous principal not allowed".to_string()
        }
        ExchangeRateError::Pending => "rate pending".to_string(),
        ExchangeRateError::CryptoBaseAssetNotFound => "crypto base asset not found".to_string(),
        ExchangeRateError::CryptoQuoteAssetNotFound => "crypto quote asset not found".to_string(),
        ExchangeRateError::StablecoinRateNotFound => "stablecoin rate not found".to_string(),
        ExchangeRateError::StablecoinRateTooFewRates => "stablecoin rate too few rates".to_string(),
        ExchangeRateError::StablecoinRateZeroRate => "stablecoin rate zero".to_string(),
        ExchangeRateError::ForexInvalidTimestamp => "forex invalid timestamp".to_string(),
        ExchangeRateError::ForexBaseAssetNotFound => "forex base asset not found".to_string(),
        ExchangeRateError::ForexQuoteAssetNotFound => "forex quote asset not found".to_string(),
        ExchangeRateError::ForexAssetsNotFound => "forex assets not found".to_string(),
        ExchangeRateError::RateLimited => "rate limited".to_string(),
        ExchangeRateError::NotEnoughCycles => "not enough cycles".to_string(),
        ExchangeRateError::FailedToAcceptCycles => "failed to accept cycles".to_string(),
        ExchangeRateError::InconsistentRatesReceived => "inconsistent rates received".to_string(),
        ExchangeRateError::Other { code, description } => {
            format!("other ({}): {}", code, description)
        }
    }
}

/// Production implementation — calls the ICP Exchange Rate Canister.
struct IcOracle;

#[async_trait(?Send)]
impl PriceOracle for IcOracle {
    async fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError> {
        let xrc = Principal::from_text(XRC_CANISTER_ID).map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTERNAL_ERROR,
                Some(&format!("Invalid XRC canister ID: {}", e)),
                None,
            )
        })?;
        let timestamp_secs = round_to_hour_secs(ic::time());

        let request = GetExchangeRateRequest {
            base_asset: Asset {
                symbol: "BTC".to_string(),
                class: AssetClass::Cryptocurrency,
            },
            quote_asset: Asset {
                symbol: "USD".to_string(),
                class: AssetClass::FiatCurrency,
            },
            timestamp: Some(timestamp_secs),
        };

        let response = ic_cdk::call::Call::bounded_wait(xrc, "get_exchange_rate")
            .with_arg(&request)
            .with_cycles(XRC_CYCLES)
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("get_exchange_rate (bounded_wait): {:?}", e)),
                    None,
                )
            })?;

        let result: GetExchangeRateResult = response.candid().map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("get_exchange_rate decode: {:?}", e)),
                None,
            )
        })?;

        match result {
            Ok(exchange_rate) => rate_to_cents(exchange_rate.rate, exchange_rate.metadata.decimals),
            Err(e) => Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!(
                    "get_exchange_rate rejected: {}",
                    format_xrc_error(&e)
                )),
                None,
            )),
        }
    }
}

pub struct StubOracle {
    price_cents: u64,
}

impl StubOracle {
    pub fn new(price_cents: u64) -> Self {
        Self { price_cents }
    }
}

#[async_trait(?Send)]
impl PriceOracle for StubOracle {
    async fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError> {
        Ok(self.price_cents)
    }
}

thread_local! {
    static ORACLE: RefCell<Rc<dyn PriceOracle>> = RefCell::new(Rc::new(IcOracle));
}

pub async fn get_btc_usd_price_cents() -> Result<u64, VolumetricError> {
    let oracle = ORACLE.with(|o| Rc::clone(&o.borrow()));
    oracle.get_btc_usd_price_cents().await
}

#[cfg(feature = "testing")]
pub(crate) fn set_oracle_price_internal(price_cents: u64) {
    ORACLE.with(|o| *o.borrow_mut() = Rc::new(StubOracle::new(price_cents)));
}

#[cfg(feature = "testing")]
pub(crate) fn reset_oracle_internal() {
    ORACLE.with(|o| *o.borrow_mut() = Rc::new(IcOracle));
}

/// Swap the oracle implementation (test-only, compiled out in production).
#[cfg(test)]
pub fn set_oracle(client: Rc<dyn PriceOracle>) {
    ORACLE.with(|o| *o.borrow_mut() = client);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_round_to_hour_secs() {
        // given
        let nanos_at_14_30 = 14 * 3600 * NANOS_PER_SECOND + 30 * 60 * NANOS_PER_SECOND;

        // when
        let rounded = round_to_hour_secs(nanos_at_14_30);

        // then
        let expected_14_00 = 14 * 3600;
        assert_eq!(rounded, expected_14_00);
    }

    #[test]
    fn test_round_to_hour_secs_exact() {
        // given
        let nanos_at_14_00 = 14 * 3600 * NANOS_PER_SECOND;

        // when
        let rounded = round_to_hour_secs(nanos_at_14_00);

        // then
        assert_eq!(rounded, 14 * 3600);
    }

    #[test]
    fn test_rate_to_cents() {
        // given: BTC at $100,000 with 9 decimals
        let rate = 100_000_000_000_000u64;
        let decimals = 9u32;

        // when
        let cents = rate_to_cents(rate, decimals).unwrap();

        // then
        let expected_cents = 10_000_000u64;
        assert_eq!(cents, expected_cents);
    }

    #[test]
    fn test_rate_to_cents_low_decimals() {
        // given: decimals lower than 2
        let rate = 100u64;
        let decimals = 1u32;

        // when
        let result = rate_to_cents(rate, decimals);

        // then
        assert!(result.is_err());
    }

    #[test]
    fn test_rate_to_cents_overflow_decimals() {
        // given: decimals so high that 10^(decimals-2) overflows u64
        let rate = 1u64;
        let decimals = 30u32;

        // when
        let result = rate_to_cents(rate, decimals);

        // then
        assert!(result.is_err());
    }
}

use std::cell::RefCell;
use std::rc::Rc;

use async_trait::async_trait;
use candid::Principal;

use crate::errors::{error_codes, VolumetricError};
use crate::generated::xrc::{
    Asset, AssetClass, ExchangeRateError, GetExchangeRateRequest, GetExchangeRateResult,
};
use crate::time::current_time_seconds;

const XRC_CANISTER_ID: &str = "uf6dk-hyaaa-aaaaq-qaaaq-cai";
const XRC_CYCLES: u128 = 1_000_000_000;
const SECONDS_PER_HOUR: u64 = 3_600;
const CENTS_DECIMALS: u32 = 2;
const BTC_SYMBOL: &str = "BTC";
const USD_SYMBOL: &str = "USD";

#[async_trait(?Send)]
pub trait PriceOracle {
    async fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError>;
    async fn get_btc_usd_price_cents_at_time_seconds(
        &self,
        settlement_time_seconds: u64,
    ) -> Result<u64, VolumetricError>;
}

pub(crate) fn xrc_timestamp_seconds_for_time_seconds(time_seconds: u64) -> u64 {
    (time_seconds / SECONDS_PER_HOUR) * SECONDS_PER_HOUR
}

fn rate_to_cents(rate: u64, decimals: u32) -> Result<u64, VolumetricError> {
    if rate == 0 {
        return Err(VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some("XRC rate is zero"),
            None,
        ));
    }
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

fn validate_exchange_rate_response(
    exchange_rate: &crate::generated::xrc::ExchangeRate,
    requested_timestamp_secs: u64,
) -> Result<(), VolumetricError> {
    if exchange_rate.base_asset.symbol != BTC_SYMBOL
        || !matches!(&exchange_rate.base_asset.class, AssetClass::Cryptocurrency)
    {
        return Err(VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some("XRC base asset mismatch"),
            None,
        ));
    }

    if exchange_rate.quote_asset.symbol != USD_SYMBOL
        || !matches!(&exchange_rate.quote_asset.class, AssetClass::FiatCurrency)
    {
        return Err(VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some("XRC quote asset mismatch"),
            None,
        ));
    }

    if exchange_rate.timestamp != requested_timestamp_secs {
        return Err(VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some(&format!(
                "XRC timestamp mismatch: requested={}, received={}",
                requested_timestamp_secs, exchange_rate.timestamp
            )),
            None,
        ));
    }

    Ok(())
}

pub async fn call_xrc_get_exchange_rate(
    request: GetExchangeRateRequest,
) -> Result<GetExchangeRateResult, VolumetricError> {
    let xrc = Principal::from_text(XRC_CANISTER_ID).map_err(|e| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some(&format!("Invalid XRC canister ID: {}", e)),
            None,
        )
    })?;

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

    response.candid().map_err(|e| {
        VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some(&format!("get_exchange_rate decode: {:?}", e)),
            None,
        )
    })
}

/// Spot BTC/USD quote from XRC using the default timestamp (start of current minute per XRC spec).
pub async fn fetch_xrc_btc_usd_exchange_rate_snapshot_raw(
) -> Result<GetExchangeRateResult, VolumetricError> {
    let request = GetExchangeRateRequest {
        base_asset: Asset {
            symbol: BTC_SYMBOL.to_string(),
            class: AssetClass::Cryptocurrency,
        },
        quote_asset: Asset {
            symbol: USD_SYMBOL.to_string(),
            class: AssetClass::FiatCurrency,
        },
        timestamp: None,
    };
    call_xrc_get_exchange_rate(request).await
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
        self.get_btc_usd_price_cents_at_time_seconds(current_time_seconds())
            .await
    }

    async fn get_btc_usd_price_cents_at_time_seconds(
        &self,
        settlement_time_seconds: u64,
    ) -> Result<u64, VolumetricError> {
        let timestamp_secs = xrc_timestamp_seconds_for_time_seconds(settlement_time_seconds);

        let request = GetExchangeRateRequest {
            base_asset: Asset {
                symbol: BTC_SYMBOL.to_string(),
                class: AssetClass::Cryptocurrency,
            },
            quote_asset: Asset {
                symbol: USD_SYMBOL.to_string(),
                class: AssetClass::FiatCurrency,
            },
            timestamp: Some(timestamp_secs),
        };

        let result = call_xrc_get_exchange_rate(request).await?;

        match result {
            Ok(exchange_rate) => {
                validate_exchange_rate_response(&exchange_rate, timestamp_secs)?;
                rate_to_cents(exchange_rate.rate, exchange_rate.metadata.decimals)
            }
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

    async fn get_btc_usd_price_cents_at_time_seconds(
        &self,
        _settlement_time_seconds: u64,
    ) -> Result<u64, VolumetricError> {
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

pub async fn get_btc_usd_price_cents_at_time_seconds(
    settlement_time_seconds: u64,
) -> Result<u64, VolumetricError> {
    let oracle = ORACLE.with(|o| Rc::clone(&o.borrow()));
    oracle
        .get_btc_usd_price_cents_at_time_seconds(settlement_time_seconds)
        .await
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
    use crate::generated::xrc::{ExchangeRate, ExchangeRateMetadata};

    const TEST_TIMESTAMP_SECS: u64 = 50_400;
    const TEST_RATE: u64 = 100_000_000_000_000;
    const TEST_DECIMALS: u32 = 9;

    fn make_exchange_rate(overrides: ExchangeRateOverrides) -> ExchangeRate {
        ExchangeRate {
            metadata: ExchangeRateMetadata {
                decimals: TEST_DECIMALS,
                forex_timestamp: None,
                quote_asset_num_received_rates: 4,
                base_asset_num_received_rates: 4,
                base_asset_num_queried_sources: 4,
                standard_deviation: 0,
                quote_asset_num_queried_sources: 4,
            },
            rate: overrides.rate.unwrap_or(TEST_RATE),
            timestamp: overrides.timestamp.unwrap_or(TEST_TIMESTAMP_SECS),
            quote_asset: overrides.quote_asset.unwrap_or_else(|| Asset {
                symbol: USD_SYMBOL.to_string(),
                class: AssetClass::FiatCurrency,
            }),
            base_asset: overrides.base_asset.unwrap_or_else(|| Asset {
                symbol: BTC_SYMBOL.to_string(),
                class: AssetClass::Cryptocurrency,
            }),
        }
    }

    #[derive(Default)]
    struct ExchangeRateOverrides {
        base_asset: Option<Asset>,
        quote_asset: Option<Asset>,
        timestamp: Option<u64>,
        rate: Option<u64>,
    }

    #[test]
    fn test_xrc_timestamp_seconds_for_time_seconds_rounds_down_to_hour() {
        // given
        let seconds_at_14_30 = 14 * 3600 + 30 * 60;

        // when
        let rounded = xrc_timestamp_seconds_for_time_seconds(seconds_at_14_30);

        // then
        let expected_14_00 = 14 * 3600;
        assert_eq!(rounded, expected_14_00);
    }

    #[test]
    fn test_xrc_timestamp_seconds_for_time_seconds_keeps_exact_hour() {
        // given
        let seconds_at_14_00 = 14 * 3600;

        // when
        let rounded = xrc_timestamp_seconds_for_time_seconds(seconds_at_14_00);

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

    #[test]
    fn should_accept_matching_btc_usd_response_for_requested_timestamp() {
        // given
        let exchange_rate = make_exchange_rate(ExchangeRateOverrides::default());

        // when
        let result = validate_exchange_rate_response(&exchange_rate, TEST_TIMESTAMP_SECS);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn should_reject_response_with_mismatched_base_asset() {
        // given
        let exchange_rate = make_exchange_rate(ExchangeRateOverrides {
            base_asset: Some(Asset {
                symbol: "ETH".to_string(),
                class: AssetClass::Cryptocurrency,
            }),
            ..Default::default()
        });

        // when
        let result = validate_exchange_rate_response(&exchange_rate, TEST_TIMESTAMP_SECS);

        // then
        assert!(result.is_err());
    }

    #[test]
    fn should_reject_response_with_mismatched_quote_asset() {
        // given
        let exchange_rate = make_exchange_rate(ExchangeRateOverrides {
            quote_asset: Some(Asset {
                symbol: "EUR".to_string(),
                class: AssetClass::FiatCurrency,
            }),
            ..Default::default()
        });

        // when
        let result = validate_exchange_rate_response(&exchange_rate, TEST_TIMESTAMP_SECS);

        // then
        assert!(result.is_err());
    }

    #[test]
    fn should_reject_response_with_mismatched_timestamp() {
        // given
        const UNEXPECTED_TIMESTAMP_SECS: u64 = TEST_TIMESTAMP_SECS + SECONDS_PER_HOUR;
        let exchange_rate = make_exchange_rate(ExchangeRateOverrides {
            timestamp: Some(UNEXPECTED_TIMESTAMP_SECS),
            ..Default::default()
        });

        // when
        let result = validate_exchange_rate_response(&exchange_rate, TEST_TIMESTAMP_SECS);

        // then
        assert!(result.is_err());
    }

    #[test]
    fn should_reject_zero_rate_before_converting_to_cents() {
        // given
        const ZERO_RATE: u64 = 0;

        // when
        let result = rate_to_cents(ZERO_RATE, TEST_DECIMALS);

        // then
        assert!(result.is_err());
    }
}

//! BTC/USD price oracle backed by the XRC canister with a stable in-canister cache.
//!
//! Three flows, each picks a different primary source:
//!
//!   get_btc_usd_price_cents            (testing force-settle) : cache -> fresh XRC -> cache fallback
//!   get_accept_btc_usd_price_cents     (accept offer)         : fresh XRC -> cache fallback
//!   get_settlement_btc_usd_price_cents (option settlement)    : historical XRC at expiry -> closest in-window of (fresh, cache)
//!
//! Freshness is always checked against the XRC-reported timestamp (not local fetch
//! time) within a 30-minute window.

use std::cell::RefCell;
use std::rc::Rc;

use async_trait::async_trait;
use candid::Principal;

use crate::errors::{error_codes, VolumetricError};
use crate::generated::xrc::{
    Asset, AssetClass, ExchangeRate, ExchangeRateError, GetExchangeRateRequest,
    GetExchangeRateResult,
};
use crate::storage::{
    get_latest_xrc_btc_usd_rate, get_nearest_xrc_btc_usd_rate_within_seconds,
    insert_xrc_btc_usd_rate, StoredXrcBtcUsdRate,
};
use crate::time::current_time_seconds;

const XRC_CANISTER_ID: &str = "uf6dk-hyaaa-aaaaq-qaaaq-cai";
const XRC_CYCLES: u128 = 1_000_000_000;
const SECONDS_PER_HOUR: u64 = 3_600;
const CENTS_DECIMALS: u32 = 2;
const BTC_SYMBOL: &str = "BTC";
const USD_SYMBOL: &str = "USD";
const PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS: u64 = 30 * 60;
const XRC_FRESH_PRICE_MAX_ATTEMPTS: u8 = 5;

#[async_trait(?Send)]
pub trait PriceOracle {
    async fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError>;
    async fn get_accept_btc_usd_price_cents(&self) -> Result<u64, VolumetricError>;
    async fn get_settlement_btc_usd_price_cents(
        &self,
        expiry_timestamp_seconds: u64,
    ) -> Result<u64, VolumetricError>;
}

pub async fn get_btc_usd_price_cents() -> Result<u64, VolumetricError> {
    let oracle = ORACLE.with(|o| Rc::clone(&o.borrow()));
    oracle.get_btc_usd_price_cents().await
}

pub async fn get_accept_btc_usd_price_cents() -> Result<u64, VolumetricError> {
    let oracle = ORACLE.with(|o| Rc::clone(&o.borrow()));
    oracle.get_accept_btc_usd_price_cents().await
}

pub async fn get_settlement_btc_usd_price_cents(
    expiry_timestamp_seconds: u64,
) -> Result<u64, VolumetricError> {
    let oracle = ORACLE.with(|o| Rc::clone(&o.borrow()));
    oracle
        .get_settlement_btc_usd_price_cents(expiry_timestamp_seconds)
        .await
}

pub async fn fetch_and_store_xrc_btc_usd_exchange_rate_snapshot(
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    fetch_and_store_current_xrc_btc_usd_rate_near_timestamp(current_time_seconds()).await
}

pub(crate) fn xrc_timestamp_seconds_for_time_seconds(time_seconds: u64) -> u64 {
    (time_seconds / SECONDS_PER_HOUR) * SECONDS_PER_HOUR
}

fn btc_usd_exchange_rate_request(timestamp: Option<u64>) -> GetExchangeRateRequest {
    GetExchangeRateRequest {
        base_asset: Asset {
            symbol: BTC_SYMBOL.to_string(),
            class: AssetClass::Cryptocurrency,
        },
        quote_asset: Asset {
            symbol: USD_SYMBOL.to_string(),
            class: AssetClass::FiatCurrency,
        },
        timestamp,
    }
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

fn validate_exchange_rate_assets(exchange_rate: &ExchangeRate) -> Result<(), VolumetricError> {
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

    Ok(())
}

#[cfg(test)]
fn validate_exchange_rate_response(
    exchange_rate: &ExchangeRate,
    requested_timestamp_secs: u64,
) -> Result<(), VolumetricError> {
    validate_exchange_rate_assets(exchange_rate)?;

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

/// Returns true when `xrc_timestamp_seconds` is within `max_delta_seconds` of
/// `target_timestamp_seconds` (absolute distance).
fn is_xrc_timestamp_within_seconds(
    xrc_timestamp_seconds: u64,
    target_timestamp_seconds: u64,
    max_delta_seconds: u64,
) -> bool {
    xrc_timestamp_seconds.abs_diff(target_timestamp_seconds) <= max_delta_seconds
}

/// Rejects an XRC response whose `timestamp` is farther than `max_delta_seconds`
/// from `target_timestamp_seconds` (used for the 30-minute window checks).
fn validate_exchange_rate_timestamp_within_seconds(
    exchange_rate: &ExchangeRate,
    target_timestamp_seconds: u64,
    max_delta_seconds: u64,
) -> Result<(), VolumetricError> {
    if is_xrc_timestamp_within_seconds(
        exchange_rate.timestamp,
        target_timestamp_seconds,
        max_delta_seconds,
    ) {
        return Ok(());
    }

    Err(VolumetricError::from_def(
        error_codes::INTER_CANISTER_CALL_FAILED,
        Some(&format!(
            "XRC timestamp outside window: target={}, received={}, max_delta={}",
            target_timestamp_seconds, exchange_rate.timestamp, max_delta_seconds
        )),
        None,
    ))
}

async fn call_xrc_get_exchange_rate(
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

fn xrc_error_to_volumetric_error(error: &ExchangeRateError) -> VolumetricError {
    VolumetricError::from_def(
        error_codes::INTER_CANISTER_CALL_FAILED,
        Some(&format!(
            "get_exchange_rate rejected: {}",
            format_xrc_error(error)
        )),
        None,
    )
}

/// Maps an XRC `get_exchange_rate` variant into `Ok(ExchangeRate)` or a typed error.
fn exchange_rate_from_result(
    result: GetExchangeRateResult,
) -> Result<ExchangeRate, VolumetricError> {
    match result {
        Ok(exchange_rate) => Ok(exchange_rate),
        Err(error) => Err(xrc_error_to_volumetric_error(&error)),
    }
}

/// Converts a validated `ExchangeRate` into cents, attaches metadata, inserts into
/// stable XRC cache, and returns the stored row.
fn store_validated_xrc_btc_usd_exchange_rate(
    exchange_rate: ExchangeRate,
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    let price_cents = rate_to_cents(exchange_rate.rate, exchange_rate.metadata.decimals)?;
    let stored_rate = StoredXrcBtcUsdRate {
        xrc_timestamp_seconds: exchange_rate.timestamp,
        fetched_at_seconds: current_time_seconds(),
        price_cents,
        decimals: exchange_rate.metadata.decimals,
    };
    insert_xrc_btc_usd_rate(stored_rate.clone());
    Ok(stored_rate)
}

#[cfg(test)]
fn store_xrc_btc_usd_exchange_rate_result(
    result: GetExchangeRateResult,
    expected_timestamp_seconds: Option<u64>,
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    let exchange_rate = exchange_rate_from_result(result)?;

    match expected_timestamp_seconds {
        Some(expected) => validate_exchange_rate_response(&exchange_rate, expected)?,
        None => validate_exchange_rate_assets(&exchange_rate)?,
    }

    store_validated_xrc_btc_usd_exchange_rate(exchange_rate)
}

/// Parses an XRC result, validates assets and that the response timestamp lies within
/// `max_delta_seconds` of `target_timestamp_seconds`, then stores the rate.
fn store_xrc_btc_usd_exchange_rate_result_near_timestamp(
    result: GetExchangeRateResult,
    target_timestamp_seconds: u64,
    max_delta_seconds: u64,
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    let exchange_rate = exchange_rate_from_result(result)?;
    validate_exchange_rate_assets(&exchange_rate)?;
    validate_exchange_rate_timestamp_within_seconds(
        &exchange_rate,
        target_timestamp_seconds,
        max_delta_seconds,
    )?;
    store_validated_xrc_btc_usd_exchange_rate(exchange_rate)
}

/// One fresh XRC call (`timestamp = None`); cached only if within 30 min of target.
async fn fetch_and_store_current_xrc_btc_usd_rate_near_timestamp(
    target_timestamp_seconds: u64,
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    let result = call_xrc_get_exchange_rate(btc_usd_exchange_rate_request(None)).await?;
    store_xrc_btc_usd_exchange_rate_result_near_timestamp(
        result,
        target_timestamp_seconds,
        PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS,
    )
}

/// One historical XRC call (`timestamp = Some(...)`); cached only if within 30 min of target.
async fn fetch_and_store_historical_xrc_btc_usd_rate_near_timestamp(
    requested_timestamp_seconds: u64,
    target_timestamp_seconds: u64,
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    let result = call_xrc_get_exchange_rate(btc_usd_exchange_rate_request(Some(
        requested_timestamp_seconds,
    )))
    .await?;
    store_xrc_btc_usd_exchange_rate_result_near_timestamp(
        result,
        target_timestamp_seconds,
        PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS,
    )
}

/// Up to `XRC_FRESH_PRICE_MAX_ATTEMPTS` fresh fetches; returns first in-window hit.
/// TODO: classify errors so deterministic XRC failures (RateLimited, NotEnoughCycles)
/// don't burn paid retries.
async fn fetch_current_xrc_btc_usd_rate_near_timestamp_with_retry(
    target_timestamp_seconds: u64,
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    let mut last_error = None;
    for attempt_index in 0..XRC_FRESH_PRICE_MAX_ATTEMPTS {
        match fetch_and_store_current_xrc_btc_usd_rate_near_timestamp(target_timestamp_seconds)
            .await
        {
            Ok(stored_rate) => return Ok(stored_rate),
            Err(error) => {
                let attempt_number = attempt_index.saturating_add(1);
                let has_attempts_remaining = attempt_number < XRC_FRESH_PRICE_MAX_ATTEMPTS;
                logging::warn!(
                    "oracle xrc: fresh current fetch attempt {} of {} failed target_ts={} will_retry_immediately={} err={}",
                    attempt_number,
                    XRC_FRESH_PRICE_MAX_ATTEMPTS,
                    target_timestamp_seconds,
                    has_attempts_remaining,
                    error
                );
                last_error = Some(error);
            }
        }
    }

    let final_error = last_error.unwrap_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some("fresh XRC price unavailable"),
            None,
        )
    });
    logging::error!(
        "oracle xrc: fresh current fetch exhausted all attempts target_ts={} err={}",
        target_timestamp_seconds,
        final_error
    );
    Err(final_error)
}

#[cfg(test)]
fn is_fresh_current_price_rate(stored_rate: &StoredXrcBtcUsdRate, now_seconds: u64) -> bool {
    is_xrc_timestamp_within_seconds(
        stored_rate.xrc_timestamp_seconds,
        now_seconds,
        PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS,
    )
}

/// Latest row in stable XRC cache whose XRC timestamp is within 30 minutes of
/// `now_seconds` (used as fallback when fresh XRC retries fail).
fn get_current_cached_xrc_btc_usd_rate(now_seconds: u64) -> Option<StoredXrcBtcUsdRate> {
    get_latest_xrc_btc_usd_rate().filter(|stored_rate| {
        is_xrc_timestamp_within_seconds(
            stored_rate.xrc_timestamp_seconds,
            now_seconds,
            PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS,
        )
    })
}

/// Picks whichever in-window candidate has the XRC timestamp closest to target
/// (earlier wins ties).
fn choose_closest_rate_to_timestamp(
    target_timestamp_seconds: u64,
    fresh_rate: Option<StoredXrcBtcUsdRate>,
    cached_rate: Option<StoredXrcBtcUsdRate>,
) -> Option<StoredXrcBtcUsdRate> {
    std::iter::once(fresh_rate)
        .chain(std::iter::once(cached_rate))
        .flatten()
        .filter(|stored_rate| {
            is_xrc_timestamp_within_seconds(
                stored_rate.xrc_timestamp_seconds,
                target_timestamp_seconds,
                PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS,
            )
        })
        .min_by_key(|stored_rate| {
            (
                stored_rate
                    .xrc_timestamp_seconds
                    .abs_diff(target_timestamp_seconds),
                stored_rate.xrc_timestamp_seconds,
            )
        })
}

async fn get_fallback_settlement_btc_usd_price_cents(
    expiry_timestamp_seconds: u64,
) -> Result<u64, VolumetricError> {
    let (fresh_rate, fresh_error) =
        match fetch_current_xrc_btc_usd_rate_near_timestamp_with_retry(expiry_timestamp_seconds)
            .await
        {
            Ok(stored_rate) => (Some(stored_rate), None),
            Err(error) => {
                logging::warn!(
                    "oracle settlement: fresh current XRC failed after retries expiry_ts={} err={}",
                    expiry_timestamp_seconds,
                    error
                );
                (None, Some(error))
            }
        };
    let cached_rate = get_nearest_xrc_btc_usd_rate_within_seconds(
        expiry_timestamp_seconds,
        PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS,
    );

    if let Some(stored_rate) =
        choose_closest_rate_to_timestamp(expiry_timestamp_seconds, fresh_rate, cached_rate)
    {
        if fresh_error.is_some() {
            logging::warn!(
                "oracle settlement: using fallback cache price expiry_ts={} chosen_xrc_ts={}",
                expiry_timestamp_seconds,
                stored_rate.xrc_timestamp_seconds
            );
        }
        return Ok(stored_rate.price_cents);
    }

    let error = fresh_error.unwrap_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("settlement fallback selector rejected validated fresh XRC rate"),
            None,
        )
    });
    logging::error!(
        "oracle settlement: no valid fresh or cached fallback rate within window expiry_ts={} err={}",
        expiry_timestamp_seconds,
        error
    );
    Err(error)
}

struct IcOracle;

#[async_trait(?Send)]
impl PriceOracle for IcOracle {
    // Spot: cache -> fresh XRC -> cache fallback.
    async fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError> {
        let now_seconds = current_time_seconds();
        if let Some(stored_rate) = get_current_cached_xrc_btc_usd_rate(now_seconds) {
            return Ok(stored_rate.price_cents);
        }

        match fetch_current_xrc_btc_usd_rate_near_timestamp_with_retry(now_seconds).await {
            Ok(stored_rate) => Ok(stored_rate.price_cents),
            Err(fresh_error) => get_current_cached_xrc_btc_usd_rate(now_seconds)
                .map(|stored_rate| {
                    logging::warn!(
                        "oracle spot: fresh XRC failed after retries; using in-window cache err={}",
                        fresh_error
                    );
                    stored_rate.price_cents
                })
                .ok_or_else(|| {
                    logging::error!(
                        "oracle spot: fresh XRC failed and no in-window cache err={}",
                        fresh_error
                    );
                    fresh_error
                }),
        }
    }

    // Accept: fresh XRC -> cache fallback. Cache is never primary; user writes must
    // price against a current quote.
    async fn get_accept_btc_usd_price_cents(&self) -> Result<u64, VolumetricError> {
        let now_seconds = current_time_seconds();
        match fetch_current_xrc_btc_usd_rate_near_timestamp_with_retry(now_seconds).await {
            Ok(stored_rate) => Ok(stored_rate.price_cents),
            Err(fresh_error) => get_current_cached_xrc_btc_usd_rate(now_seconds)
                .map(|stored_rate| {
                    logging::warn!(
                        "oracle accept current: fresh XRC failed after retries; using in-window cache err={}",
                        fresh_error
                    );
                    stored_rate.price_cents
                })
                .ok_or_else(|| {
                    logging::error!(
                        "oracle accept current: fresh XRC failed and no in-window cache err={}",
                        fresh_error
                    );
                    fresh_error
                }),
        }
    }

    // Settlement: historical XRC at expiry -> fallback picks whichever in-window
    // candidate of (fresh, cache) is closer to expiry; if only one is in-window, that
    // one wins; if neither is in-window, returns the fresh-fetch error.
    async fn get_settlement_btc_usd_price_cents(
        &self,
        expiry_timestamp_seconds: u64,
    ) -> Result<u64, VolumetricError> {
        match fetch_and_store_historical_xrc_btc_usd_rate_near_timestamp(
            expiry_timestamp_seconds,
            expiry_timestamp_seconds,
        )
        .await
        {
            Ok(stored_rate) => Ok(stored_rate.price_cents),
            Err(historical_error) => {
                logging::warn!(
                    "oracle settlement: historical XRC unavailable; using fallback expiry_ts={} err={}",
                    expiry_timestamp_seconds,
                    historical_error
                );
                get_fallback_settlement_btc_usd_price_cents(expiry_timestamp_seconds).await
            }
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

    async fn get_accept_btc_usd_price_cents(&self) -> Result<u64, VolumetricError> {
        Ok(self.price_cents)
    }

    async fn get_settlement_btc_usd_price_cents(
        &self,
        _expiry_timestamp_seconds: u64,
    ) -> Result<u64, VolumetricError> {
        Ok(self.price_cents)
    }
}

thread_local! {
    static ORACLE: RefCell<Rc<dyn PriceOracle>> = RefCell::new(Rc::new(IcOracle));
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

    use crate::generated::xrc::ExchangeRateMetadata;
    use crate::ic::{self, IcRuntime};
    use crate::storage::get_xrc_btc_usd_rate;

    const TEST_TIMESTAMP_SECS: u64 = 50_400;
    const TEST_NOW_NS: u64 = 60_000_000_000_000;
    const TEST_RATE: u64 = 100_000_000_000_000;
    const TEST_DECIMALS: u32 = 9;
    const TEST_PRICE_CENTS: u64 = 10_000_000;
    const TEST_SOURCE_COUNT: u64 = 4;
    const ONE_MINUTE_SECS: u64 = 60;

    struct MockRuntime;

    impl IcRuntime for MockRuntime {
        fn time(&self) -> u64 {
            TEST_NOW_NS
        }

        fn canister_self(&self) -> Principal {
            Principal::anonymous()
        }

        fn log(&self, _message: &str) {}
    }

    #[derive(Default)]
    struct ExchangeRateOverrides {
        base_asset: Option<Asset>,
        quote_asset: Option<Asset>,
        timestamp: Option<u64>,
        rate: Option<u64>,
    }

    fn make_exchange_rate(overrides: ExchangeRateOverrides) -> ExchangeRate {
        ExchangeRate {
            metadata: ExchangeRateMetadata {
                decimals: TEST_DECIMALS,
                forex_timestamp: None,
                quote_asset_num_received_rates: TEST_SOURCE_COUNT,
                base_asset_num_received_rates: TEST_SOURCE_COUNT,
                base_asset_num_queried_sources: TEST_SOURCE_COUNT,
                standard_deviation: 0,
                quote_asset_num_queried_sources: TEST_SOURCE_COUNT,
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

    fn make_stored_rate(xrc_timestamp_seconds: u64) -> StoredXrcBtcUsdRate {
        make_stored_rate_with_price(xrc_timestamp_seconds, TEST_PRICE_CENTS)
    }

    fn make_stored_rate_with_price(
        xrc_timestamp_seconds: u64,
        price_cents: u64,
    ) -> StoredXrcBtcUsdRate {
        StoredXrcBtcUsdRate {
            xrc_timestamp_seconds,
            fetched_at_seconds: xrc_timestamp_seconds,
            price_cents,
            decimals: TEST_DECIMALS,
        }
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

    /// Given: an accept flow needs a fresh current BTC/USD price
    /// When: building the XRC request for the current snapshot
    /// Then: the request omits timestamp so XRC returns the current rate
    #[test]
    fn should_build_current_btc_usd_request_without_timestamp() {
        // given
        const CURRENT_TIMESTAMP: Option<u64> = None;

        // when
        let request = btc_usd_exchange_rate_request(CURRENT_TIMESTAMP);

        // then
        assert_eq!(request.timestamp, None);
        assert_eq!(request.base_asset.symbol, BTC_SYMBOL);
        assert_eq!(request.quote_asset.symbol, USD_SYMBOL);
    }

    /// Given: a settlement flow needs the BTC/USD price for an expiry hour
    /// When: building the historical XRC request for that expiry
    /// Then: the request includes the hour-aligned expiry timestamp
    #[test]
    fn should_build_historical_btc_usd_request_with_expiry_timestamp() {
        // given
        const EXPIRY_TIMESTAMP_SECONDS: u64 = TEST_TIMESTAMP_SECS;

        // when
        let request = btc_usd_exchange_rate_request(Some(EXPIRY_TIMESTAMP_SECONDS));

        // then
        assert_eq!(request.timestamp, Some(EXPIRY_TIMESTAMP_SECONDS));
        assert_eq!(request.base_asset.symbol, BTC_SYMBOL);
        assert_eq!(request.quote_asset.symbol, USD_SYMBOL);
    }

    /// Given: a cached rate whose XRC timestamp is within the freshness window
    /// When: checking freshness for the current price
    /// Then: the cached rate is considered fresh
    #[test]
    fn should_consider_rate_within_window_as_fresh() {
        // given
        const NOW_SECONDS: u64 = 1_000_000;
        let stored_rate =
            make_stored_rate(NOW_SECONDS - PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS);

        // when
        let is_fresh = is_fresh_current_price_rate(&stored_rate, NOW_SECONDS);

        // then
        assert!(is_fresh);
    }

    /// Given: a cached rate whose XRC timestamp is older than the freshness window
    /// When: checking freshness for the current price
    /// Then: the cached rate is considered stale
    #[test]
    fn should_consider_rate_older_than_window_as_stale() {
        // given
        const NOW_SECONDS: u64 = 1_000_000;
        let stored_rate =
            make_stored_rate(NOW_SECONDS - PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS - 1);

        // when
        let is_fresh = is_fresh_current_price_rate(&stored_rate, NOW_SECONDS);

        // then
        assert!(!is_fresh);
    }

    /// Given: settlement expiry is 14:00 with fresh 14:04 and cached 13:58 candidates
    /// When: selecting the closest candidate to expiry
    /// Then: the cached 13:58 price is selected because it is closer to expiry
    #[test]
    fn should_select_cached_settlement_rate_when_closer_to_expiry_than_fresh_current_rate() {
        // given
        const EXPIRY_TIMESTAMP_SECONDS: u64 = 14 * SECONDS_PER_HOUR;
        const FRESH_TIMESTAMP_SECONDS: u64 = EXPIRY_TIMESTAMP_SECONDS + 4 * ONE_MINUTE_SECS;
        const CACHED_TIMESTAMP_SECONDS: u64 = EXPIRY_TIMESTAMP_SECONDS - 2 * ONE_MINUTE_SECS;
        const FRESH_PRICE_CENTS: u64 = 11_000_000;
        const EXPECTED_CACHED_PRICE_CENTS: u64 = 11_234_567;
        let fresh_rate = make_stored_rate_with_price(FRESH_TIMESTAMP_SECONDS, FRESH_PRICE_CENTS);
        let cached_rate =
            make_stored_rate_with_price(CACHED_TIMESTAMP_SECONDS, EXPECTED_CACHED_PRICE_CENTS);

        // when
        let selected_rate = choose_closest_rate_to_timestamp(
            EXPIRY_TIMESTAMP_SECONDS,
            Some(fresh_rate),
            Some(cached_rate),
        )
        .expect("one settlement candidate should be selected");

        // then
        assert_eq!(selected_rate.price_cents, EXPECTED_CACHED_PRICE_CENTS);
        assert_eq!(
            selected_rate.xrc_timestamp_seconds,
            CACHED_TIMESTAMP_SECONDS
        );
    }

    /// Given: settlement expiry is 14:00 with fresh 14:01 and cached 13:58 candidates
    /// When: selecting the closest candidate to expiry
    /// Then: the fresh current price is selected because it is closer to expiry
    #[test]
    fn should_select_fresh_settlement_rate_when_closer_to_expiry_than_cached_rate() {
        // given
        const EXPIRY_TIMESTAMP_SECONDS: u64 = 14 * SECONDS_PER_HOUR;
        const FRESH_TIMESTAMP_SECONDS: u64 = EXPIRY_TIMESTAMP_SECONDS + ONE_MINUTE_SECS;
        const CACHED_TIMESTAMP_SECONDS: u64 = EXPIRY_TIMESTAMP_SECONDS - 2 * ONE_MINUTE_SECS;
        const EXPECTED_FRESH_PRICE_CENTS: u64 = 12_000_000;
        const CACHED_PRICE_CENTS: u64 = 11_000_000;
        let fresh_rate =
            make_stored_rate_with_price(FRESH_TIMESTAMP_SECONDS, EXPECTED_FRESH_PRICE_CENTS);
        let cached_rate = make_stored_rate_with_price(CACHED_TIMESTAMP_SECONDS, CACHED_PRICE_CENTS);

        // when
        let selected_rate = choose_closest_rate_to_timestamp(
            EXPIRY_TIMESTAMP_SECONDS,
            Some(fresh_rate),
            Some(cached_rate),
        )
        .expect("one settlement candidate should be selected");

        // then
        assert_eq!(selected_rate.price_cents, EXPECTED_FRESH_PRICE_CENTS);
        assert_eq!(selected_rate.xrc_timestamp_seconds, FRESH_TIMESTAMP_SECONDS);
    }

    /// Given: settlement has one valid cached candidate and one stale fresh candidate
    /// When: selecting the closest candidate to expiry
    /// Then: the valid cached candidate is selected
    #[test]
    fn should_ignore_settlement_candidate_outside_timestamp_window() {
        // given
        const EXPIRY_TIMESTAMP_SECONDS: u64 = 14 * SECONDS_PER_HOUR;
        const STALE_FRESH_TIMESTAMP_SECONDS: u64 =
            EXPIRY_TIMESTAMP_SECONDS + PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS + 1;
        const CACHED_TIMESTAMP_SECONDS: u64 = EXPIRY_TIMESTAMP_SECONDS - 2 * ONE_MINUTE_SECS;
        const EXPECTED_CACHED_PRICE_CENTS: u64 = 11_234_567;
        let fresh_rate =
            make_stored_rate_with_price(STALE_FRESH_TIMESTAMP_SECONDS, TEST_PRICE_CENTS);
        let cached_rate =
            make_stored_rate_with_price(CACHED_TIMESTAMP_SECONDS, EXPECTED_CACHED_PRICE_CENTS);

        // when
        let selected_rate = choose_closest_rate_to_timestamp(
            EXPIRY_TIMESTAMP_SECONDS,
            Some(fresh_rate),
            Some(cached_rate),
        )
        .expect("valid cached settlement candidate should be selected");

        // then
        assert_eq!(selected_rate.price_cents, EXPECTED_CACHED_PRICE_CENTS);
    }

    /// Given: settlement candidates are both outside the 30-minute expiry window
    /// When: selecting the closest candidate to expiry
    /// Then: no settlement candidate is selected
    #[test]
    fn should_reject_settlement_candidates_outside_timestamp_window() {
        // given
        const EXPIRY_TIMESTAMP_SECONDS: u64 = 14 * SECONDS_PER_HOUR;
        let fresh_rate = make_stored_rate(
            EXPIRY_TIMESTAMP_SECONDS + PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS + 1,
        );
        let cached_rate = make_stored_rate(
            EXPIRY_TIMESTAMP_SECONDS - PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS - 1,
        );

        // when
        let selected_rate = choose_closest_rate_to_timestamp(
            EXPIRY_TIMESTAMP_SECONDS,
            Some(fresh_rate),
            Some(cached_rate),
        );

        // then
        assert!(selected_rate.is_none());
    }

    /// Given: a historical XRC response inside the 30-minute settlement window
    /// When: storing the result for a settlement expiry
    /// Then: the rate is persisted and returned with the converted price in cents
    #[test]
    fn should_store_historical_exchange_rate_result_inside_settlement_window() {
        // given
        crate::storage::xrc_rates::clear_xrc_btc_usd_rates();
        ic::set_runtime(Box::new(MockRuntime));
        const EXPIRY_TIMESTAMP_SECONDS: u64 = TEST_TIMESTAMP_SECS;
        const RESPONSE_TIMESTAMP_SECONDS: u64 =
            EXPIRY_TIMESTAMP_SECONDS + PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS;
        let result: GetExchangeRateResult = Ok(make_exchange_rate(ExchangeRateOverrides {
            timestamp: Some(RESPONSE_TIMESTAMP_SECONDS),
            ..Default::default()
        }));

        // when
        let stored_rate = store_xrc_btc_usd_exchange_rate_result_near_timestamp(
            result,
            EXPIRY_TIMESTAMP_SECONDS,
            PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS,
        )
        .expect("historical response inside settlement window should store");

        // then
        assert_eq!(stored_rate.price_cents, TEST_PRICE_CENTS);
        assert_eq!(
            stored_rate.xrc_timestamp_seconds,
            RESPONSE_TIMESTAMP_SECONDS
        );
        assert!(get_xrc_btc_usd_rate(RESPONSE_TIMESTAMP_SECONDS).is_some());
    }

    /// Given: a historical XRC response outside the 30-minute settlement window
    /// When: storing the result for a settlement expiry
    /// Then: the rate is rejected and not persisted
    #[test]
    fn should_reject_historical_exchange_rate_result_outside_settlement_window() {
        // given
        crate::storage::xrc_rates::clear_xrc_btc_usd_rates();
        const EXPIRY_TIMESTAMP_SECONDS: u64 = TEST_TIMESTAMP_SECS;
        const RESPONSE_TIMESTAMP_SECONDS: u64 =
            EXPIRY_TIMESTAMP_SECONDS + PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS + 1;
        let result: GetExchangeRateResult = Ok(make_exchange_rate(ExchangeRateOverrides {
            timestamp: Some(RESPONSE_TIMESTAMP_SECONDS),
            ..Default::default()
        }));

        // when
        let stored_rate_result = store_xrc_btc_usd_exchange_rate_result_near_timestamp(
            result,
            EXPIRY_TIMESTAMP_SECONDS,
            PRICE_TIMESTAMP_MAX_DISTANCE_30_MINUTES_SECS,
        );

        // then
        assert!(stored_rate_result.is_err());
        assert!(get_xrc_btc_usd_rate(RESPONSE_TIMESTAMP_SECONDS).is_none());
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
    fn should_reject_zero_rate_before_converting_to_cents() {
        // given
        const ZERO_RATE: u64 = 0;

        // when
        let result = rate_to_cents(ZERO_RATE, TEST_DECIMALS);

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

    /// Given: a successful BTC/USD exchange rate response matching the expected timestamp
    /// When: storing the result
    /// Then: the rate is persisted and returned with the converted price in cents
    #[test]
    fn should_store_successful_exchange_rate_result_with_expected_timestamp() {
        // given
        crate::storage::xrc_rates::clear_xrc_btc_usd_rates();
        ic::set_runtime(Box::new(MockRuntime));
        let result: GetExchangeRateResult =
            Ok(make_exchange_rate(ExchangeRateOverrides::default()));

        // when
        let stored_rate =
            store_xrc_btc_usd_exchange_rate_result(result, Some(TEST_TIMESTAMP_SECS)).unwrap();

        // then
        assert_eq!(stored_rate.price_cents, TEST_PRICE_CENTS);
        assert_eq!(stored_rate.xrc_timestamp_seconds, TEST_TIMESTAMP_SECS);
        assert!(get_xrc_btc_usd_rate(TEST_TIMESTAMP_SECS).is_some());
    }

    /// Given: a successful response whose timestamp does not match the expected timestamp
    /// When: storing the result
    /// Then: an error is returned and nothing is persisted
    #[test]
    fn should_reject_storing_exchange_rate_result_with_mismatched_timestamp() {
        // given
        crate::storage::xrc_rates::clear_xrc_btc_usd_rates();
        const UNEXPECTED_TIMESTAMP_SECS: u64 = TEST_TIMESTAMP_SECS + SECONDS_PER_HOUR;
        let result: GetExchangeRateResult = Ok(make_exchange_rate(ExchangeRateOverrides {
            timestamp: Some(UNEXPECTED_TIMESTAMP_SECS),
            ..Default::default()
        }));

        // when
        let stored_rate_result =
            store_xrc_btc_usd_exchange_rate_result(result, Some(TEST_TIMESTAMP_SECS));

        // then
        assert!(stored_rate_result.is_err());
        assert!(get_xrc_btc_usd_rate(TEST_TIMESTAMP_SECS).is_none());
        assert!(get_xrc_btc_usd_rate(UNEXPECTED_TIMESTAMP_SECS).is_none());
    }

    /// Given: an XRC error variant
    /// When: storing the result
    /// Then: a retryable inter-canister error is returned
    #[test]
    fn should_map_xrc_error_variant_to_inter_canister_error() {
        // given
        let result: GetExchangeRateResult = Err(ExchangeRateError::RateLimited);

        // when
        let stored_rate_result = store_xrc_btc_usd_exchange_rate_result(result, None);

        // then
        let err = stored_rate_result.unwrap_err();
        assert!(err.to_string().contains("rate limited"));
    }
}

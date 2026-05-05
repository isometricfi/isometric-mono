use std::cell::RefCell;
use std::future::Future;
use std::rc::Rc;

use async_trait::async_trait;
use candid::Principal;

use crate::errors::{error_codes, VolumetricError};
use crate::generated::xrc::{
    Asset, AssetClass, ExchangeRateError, GetExchangeRateRequest, GetExchangeRateResult,
};
use crate::storage::{
    get_latest_xrc_btc_usd_rate, get_xrc_btc_usd_rate, insert_xrc_btc_usd_rate, StoredXrcBtcUsdRate,
};
use crate::time::current_time_seconds;

const XRC_CANISTER_ID: &str = "uf6dk-hyaaa-aaaaq-qaaaq-cai";
const XRC_CYCLES: u128 = 1_000_000_000;
const SECONDS_PER_HOUR: u64 = 3_600;
const CENTS_DECIMALS: u32 = 2;
const BTC_SYMBOL: &str = "BTC";
const USD_SYMBOL: &str = "USD";
const CURRENT_PRICE_CACHE_MAX_AGE_30_MINUTES_SECS: u64 = 30 * 60;

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

pub(crate) fn xrc_get_exchange_rate_snapshot_request() -> GetExchangeRateRequest {
    btc_usd_exchange_rate_request(None)
}

pub(crate) fn xrc_get_exchange_rate_request_for_settlement_time(
    settlement_time_seconds: u64,
) -> (u64, GetExchangeRateRequest) {
    let timestamp_seconds = xrc_timestamp_seconds_for_time_seconds(settlement_time_seconds);
    (
        timestamp_seconds,
        btc_usd_exchange_rate_request(Some(timestamp_seconds)),
    )
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

fn validate_exchange_rate_response(
    exchange_rate: &crate::generated::xrc::ExchangeRate,
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

fn validate_exchange_rate_assets(
    exchange_rate: &crate::generated::xrc::ExchangeRate,
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
    let request = xrc_get_exchange_rate_snapshot_request();
    call_xrc_get_exchange_rate(request).await
}

pub async fn fetch_xrc_btc_usd_exchange_rate_for_settlement_time_raw(
    settlement_time_seconds: u64,
) -> Result<(u64, GetExchangeRateResult), VolumetricError> {
    let (timestamp_seconds, request) =
        xrc_get_exchange_rate_request_for_settlement_time(settlement_time_seconds);
    let result = call_xrc_get_exchange_rate(request).await?;
    Ok((timestamp_seconds, result))
}

pub async fn fetch_and_store_xrc_btc_usd_exchange_rate_snapshot(
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    fetch_and_store_xrc_btc_usd_exchange_rate_snapshot_with_fetcher(call_xrc_get_exchange_rate)
        .await
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

fn stored_rate_from_exchange_rate(
    exchange_rate: &crate::generated::xrc::ExchangeRate,
    fetched_at_seconds: u64,
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    validate_exchange_rate_assets(exchange_rate)?;
    let price_cents = rate_to_cents(exchange_rate.rate, exchange_rate.metadata.decimals)?;

    Ok(StoredXrcBtcUsdRate {
        xrc_timestamp_seconds: exchange_rate.timestamp,
        fetched_at_seconds,
        rate: exchange_rate.rate,
        decimals: exchange_rate.metadata.decimals,
        price_cents,
        forex_timestamp: exchange_rate.metadata.forex_timestamp,
        quote_asset_num_received_rates: exchange_rate.metadata.quote_asset_num_received_rates,
        base_asset_num_received_rates: exchange_rate.metadata.base_asset_num_received_rates,
        base_asset_num_queried_sources: exchange_rate.metadata.base_asset_num_queried_sources,
        quote_asset_num_queried_sources: exchange_rate.metadata.quote_asset_num_queried_sources,
        standard_deviation: exchange_rate.metadata.standard_deviation,
    })
}

fn store_successful_xrc_btc_usd_exchange_rate(
    exchange_rate: crate::generated::xrc::ExchangeRate,
    expected_timestamp_seconds: Option<u64>,
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    if let Some(expected_timestamp_seconds) = expected_timestamp_seconds {
        validate_exchange_rate_response(&exchange_rate, expected_timestamp_seconds)?;
    } else {
        validate_exchange_rate_assets(&exchange_rate)?;
    }

    let stored_rate = stored_rate_from_exchange_rate(&exchange_rate, current_time_seconds())?;
    insert_xrc_btc_usd_rate(stored_rate.clone());
    Ok(stored_rate)
}

fn store_xrc_btc_usd_exchange_rate_result(
    result: GetExchangeRateResult,
    expected_timestamp_seconds: Option<u64>,
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    match result {
        Ok(exchange_rate) => {
            store_successful_xrc_btc_usd_exchange_rate(exchange_rate, expected_timestamp_seconds)
        }
        Err(error) => Err(xrc_error_to_volumetric_error(&error)),
    }
}

async fn fetch_and_store_xrc_btc_usd_exchange_rate_snapshot_with_fetcher<F, Fut>(
    fetcher: F,
) -> Result<StoredXrcBtcUsdRate, VolumetricError>
where
    F: FnOnce(GetExchangeRateRequest) -> Fut,
    Fut: Future<Output = Result<GetExchangeRateResult, VolumetricError>>,
{
    let request = xrc_get_exchange_rate_snapshot_request();
    let result = fetcher(request).await?;
    store_xrc_btc_usd_exchange_rate_result(result, None)
}

async fn get_current_btc_usd_price_cents_with_fetcher<F, Fut>(
    fetcher: F,
) -> Result<u64, VolumetricError>
where
    F: FnOnce(GetExchangeRateRequest) -> Fut,
    Fut: Future<Output = Result<GetExchangeRateResult, VolumetricError>>,
{
    if let Some(stored_rate) = get_latest_xrc_btc_usd_rate() {
        if is_fresh_current_price_rate(&stored_rate, current_time_seconds()) {
            return Ok(stored_rate.price_cents);
        }
    }

    let stored_rate =
        fetch_and_store_xrc_btc_usd_exchange_rate_snapshot_with_fetcher(fetcher).await?;
    Ok(stored_rate.price_cents)
}

fn is_fresh_current_price_rate(stored_rate: &StoredXrcBtcUsdRate, now_seconds: u64) -> bool {
    let fetch_age_seconds = now_seconds.saturating_sub(stored_rate.fetched_at_seconds);
    let xrc_timestamp_age_seconds = now_seconds.saturating_sub(stored_rate.xrc_timestamp_seconds);
    fetch_age_seconds <= CURRENT_PRICE_CACHE_MAX_AGE_30_MINUTES_SECS
        && xrc_timestamp_age_seconds <= CURRENT_PRICE_CACHE_MAX_AGE_30_MINUTES_SECS
}

async fn get_btc_usd_price_cents_at_time_seconds_with_fetcher<F, Fut>(
    settlement_time_seconds: u64,
    fetcher: F,
) -> Result<u64, VolumetricError>
where
    F: FnOnce(GetExchangeRateRequest) -> Fut,
    Fut: Future<Output = Result<GetExchangeRateResult, VolumetricError>>,
{
    let (timestamp_seconds, request) =
        xrc_get_exchange_rate_request_for_settlement_time(settlement_time_seconds);

    if let Some(stored_rate) = get_xrc_btc_usd_rate(timestamp_seconds) {
        return Ok(stored_rate.price_cents);
    }

    let result = fetcher(request).await?;
    let stored_rate = store_xrc_btc_usd_exchange_rate_result(result, Some(timestamp_seconds))?;
    Ok(stored_rate.price_cents)
}

/// Production implementation — calls the ICP Exchange Rate Canister.
struct IcOracle;

#[async_trait(?Send)]
impl PriceOracle for IcOracle {
    async fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError> {
        get_current_btc_usd_price_cents_with_fetcher(call_xrc_get_exchange_rate).await
    }

    async fn get_btc_usd_price_cents_at_time_seconds(
        &self,
        settlement_time_seconds: u64,
    ) -> Result<u64, VolumetricError> {
        get_btc_usd_price_cents_at_time_seconds_with_fetcher(
            settlement_time_seconds,
            call_xrc_get_exchange_rate,
        )
        .await
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
    use candid::Principal;

    use crate::generated::xrc::{ExchangeRate, ExchangeRateMetadata};
    use crate::ic::{self, IcRuntime};
    use crate::storage::xrc_rates::clear_xrc_btc_usd_rates;
    use crate::storage::{get_xrc_btc_usd_rate, insert_xrc_btc_usd_rate};

    const TEST_TIMESTAMP_SECS: u64 = 50_400;
    const TEST_NOW_NS: u64 = 60_000_000_000_000;
    const TEST_NOW_SECONDS: u64 = TEST_NOW_NS / crate::time::NANOS_PER_SECOND;
    const TEST_RATE: u64 = 100_000_000_000_000;
    const TEST_DECIMALS: u32 = 9;
    const TEST_PRICE_CENTS: u64 = 10_000_000;
    const TEST_SOURCE_COUNT: u64 = 4;

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

    #[derive(Default)]
    struct ExchangeRateOverrides {
        base_asset: Option<Asset>,
        quote_asset: Option<Asset>,
        timestamp: Option<u64>,
        rate: Option<u64>,
    }

    fn setup_oracle_cache_test() {
        clear_xrc_btc_usd_rates();
        ic::set_runtime(Box::new(MockRuntime));
    }

    fn make_stored_rate(
        xrc_timestamp_seconds: u64,
        fetched_at_seconds: u64,
    ) -> StoredXrcBtcUsdRate {
        StoredXrcBtcUsdRate {
            xrc_timestamp_seconds,
            fetched_at_seconds,
            rate: TEST_RATE,
            decimals: TEST_DECIMALS,
            price_cents: TEST_PRICE_CENTS,
            forex_timestamp: None,
            quote_asset_num_received_rates: TEST_SOURCE_COUNT,
            base_asset_num_received_rates: TEST_SOURCE_COUNT,
            base_asset_num_queried_sources: TEST_SOURCE_COUNT,
            quote_asset_num_queried_sources: TEST_SOURCE_COUNT,
            standard_deviation: 0,
        }
    }

    fn unexpected_fetch_error() -> VolumetricError {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("unexpected XRC fetch"),
            None,
        )
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

    /// Given: a BTC/USD XRC snapshot request
    /// When: building the request for the no-timestamp cache refresh path
    /// Then: the timestamp is omitted so privileged BTC/USD rate limiting is bypassed
    #[test]
    fn should_build_timestamp_omitted_xrc_snapshot_request() {
        // given

        // when
        let request = xrc_get_exchange_rate_snapshot_request();

        // then
        assert_eq!(request.timestamp, None);
        assert_eq!(request.base_asset.symbol, BTC_SYMBOL);
        assert!(matches!(
            request.base_asset.class,
            AssetClass::Cryptocurrency
        ));
        assert_eq!(request.quote_asset.symbol, USD_SYMBOL);
        assert!(matches!(
            request.quote_asset.class,
            AssetClass::FiatCurrency
        ));
    }

    /// Given: a settlement time not aligned to a UTC hour boundary
    /// When: building the XRC fallback request for that settlement time
    /// Then: the request uses the hour-floored timestamp and BTC/USD assets
    #[test]
    fn should_build_timestamped_xrc_settlement_fallback_request() {
        // given
        const SETTLEMENT_TIME_SECONDS: u64 = 14 * 3600 + 30 * 60;
        const EXPECTED_XRC_TIMESTAMP_SECONDS: u64 = 14 * 3600;

        // when
        let (xrc_timestamp_seconds, request) =
            xrc_get_exchange_rate_request_for_settlement_time(SETTLEMENT_TIME_SECONDS);

        // then
        assert_eq!(xrc_timestamp_seconds, EXPECTED_XRC_TIMESTAMP_SECONDS);
        assert_eq!(request.timestamp, Some(EXPECTED_XRC_TIMESTAMP_SECONDS));
        assert_eq!(request.base_asset.symbol, BTC_SYMBOL);
        assert!(matches!(
            request.base_asset.class,
            AssetClass::Cryptocurrency
        ));
        assert_eq!(request.quote_asset.symbol, USD_SYMBOL);
        assert!(matches!(
            request.quote_asset.class,
            AssetClass::FiatCurrency
        ));
    }

    /// Given: a fresh cached BTC/USD XRC rate
    /// When: getting the current BTC/USD price
    /// Then: the cached rate is used without fetching from XRC
    #[tokio::test]
    async fn should_use_fresh_cached_rate_for_current_btc_usd_price() {
        // given
        setup_oracle_cache_test();
        insert_xrc_btc_usd_rate(make_stored_rate(
            TEST_NOW_SECONDS - 60,
            TEST_NOW_SECONDS - 60,
        ));

        // when
        let price_cents = get_current_btc_usd_price_cents_with_fetcher(|_request| async move {
            Err(unexpected_fetch_error())
        })
        .await
        .unwrap();

        // then
        assert_eq!(price_cents, TEST_PRICE_CENTS);
    }

    /// Given: a cached BTC/USD XRC rate fetched recently for an old settlement timestamp
    /// When: getting the current BTC/USD price
    /// Then: the old XRC timestamp is not reused as the current price
    #[tokio::test]
    async fn should_not_use_recently_fetched_historical_rate_for_current_btc_usd_price() {
        // given
        setup_oracle_cache_test();
        insert_xrc_btc_usd_rate(make_stored_rate(TEST_TIMESTAMP_SECS, TEST_NOW_SECONDS - 60));

        // when
        let price_cents = get_current_btc_usd_price_cents_with_fetcher(|request| async move {
            assert_eq!(request.timestamp, None);
            Ok(Ok(make_exchange_rate(ExchangeRateOverrides {
                timestamp: Some(TEST_NOW_SECONDS),
                ..Default::default()
            })))
        })
        .await
        .unwrap();

        // then
        assert_eq!(price_cents, TEST_PRICE_CENTS);
        assert!(get_xrc_btc_usd_rate(TEST_NOW_SECONDS).is_some());
    }

    /// Given: no cached BTC/USD XRC rate
    /// When: getting the current BTC/USD price
    /// Then: XRC is called without a timestamp and the successful response is cached
    #[tokio::test]
    async fn should_fetch_and_store_timestamp_omitted_current_btc_usd_price_when_cache_missing() {
        // given
        setup_oracle_cache_test();

        // when
        let price_cents = get_current_btc_usd_price_cents_with_fetcher(|request| async move {
            assert_eq!(request.timestamp, None);
            Ok(Ok(make_exchange_rate(ExchangeRateOverrides::default())))
        })
        .await
        .unwrap();

        // then
        assert_eq!(price_cents, TEST_PRICE_CENTS);
        let stored_rate = get_xrc_btc_usd_rate(TEST_TIMESTAMP_SECS)
            .expect("successful XRC response should be cached");
        assert_eq!(stored_rate.fetched_at_seconds, TEST_NOW_SECONDS);
    }

    /// Given: an exact cached BTC/USD XRC rate for a settlement hour
    /// When: getting the BTC/USD price for that settlement time
    /// Then: the cached rate is used without fetching from XRC
    #[tokio::test]
    async fn should_use_exact_cached_rate_for_settlement_price() {
        // given
        setup_oracle_cache_test();
        insert_xrc_btc_usd_rate(make_stored_rate(TEST_TIMESTAMP_SECS, TEST_NOW_SECONDS - 60));

        // when
        let price_cents = get_btc_usd_price_cents_at_time_seconds_with_fetcher(
            TEST_TIMESTAMP_SECS + 60,
            |_request| async move { Err(unexpected_fetch_error()) },
        )
        .await
        .unwrap();

        // then
        assert_eq!(price_cents, TEST_PRICE_CENTS);
    }

    /// Given: no exact cached BTC/USD XRC rate for a settlement hour
    /// When: getting the BTC/USD settlement price
    /// Then: XRC is called with the hour timestamp and the successful response is cached
    #[tokio::test]
    async fn should_fetch_timestamped_xrc_fallback_for_missing_settlement_cache() {
        // given
        setup_oracle_cache_test();

        // when
        let price_cents = get_btc_usd_price_cents_at_time_seconds_with_fetcher(
            TEST_TIMESTAMP_SECS + 60,
            |request| async move {
                assert_eq!(request.timestamp, Some(TEST_TIMESTAMP_SECS));
                Ok(Ok(make_exchange_rate(ExchangeRateOverrides::default())))
            },
        )
        .await
        .unwrap();

        // then
        assert_eq!(price_cents, TEST_PRICE_CENTS);
        assert!(get_xrc_btc_usd_rate(TEST_TIMESTAMP_SECS).is_some());
    }

    /// Given: no exact cached BTC/USD XRC rate and XRC rate limits the timestamped fallback
    /// When: getting the BTC/USD settlement price
    /// Then: a retryable inter-canister error is returned to the caller
    #[tokio::test]
    async fn should_return_error_when_timestamped_xrc_fallback_is_rate_limited() {
        // given
        setup_oracle_cache_test();

        // when
        let result = get_btc_usd_price_cents_at_time_seconds_with_fetcher(
            TEST_TIMESTAMP_SECS + 60,
            |request| async move {
                assert_eq!(request.timestamp, Some(TEST_TIMESTAMP_SECS));
                Ok(Err(ExchangeRateError::RateLimited))
            },
        )
        .await;

        // then
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("rate limited"));
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

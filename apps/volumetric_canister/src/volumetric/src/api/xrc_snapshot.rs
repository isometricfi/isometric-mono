use candid::CandidType;
use ic_cdk::{query, update};
use serde::Deserialize;

use crate::errors::VolumetricError;
use crate::generated::xrc::GetExchangeRateResult;
use crate::guards::{is_controller, is_whitelisted, no_replicated_call};
use crate::oracle;
use crate::storage::{
    delete_xrc_btc_usd_rates_before,
    get_latest_xrc_btc_usd_rate as storage_get_latest_xrc_btc_usd_rate,
    get_xrc_btc_usd_rate as storage_get_xrc_btc_usd_rate,
    list_xrc_btc_usd_rates as storage_list_xrc_btc_usd_rates, StoredXrcBtcUsdRate,
};
use crate::timers::cleanup_old_xrc_btc_usd_rates;

const DEFAULT_XRC_RATE_LIST_LIMIT: u32 = 100;
const MAX_XRC_RATE_LIST_LIMIT: u32 = 1_000;

#[derive(CandidType, Deserialize)]
pub struct XrcSettlementTimeProbe {
    pub settlement_time_seconds: u64,
    pub xrc_request_timestamp_seconds: u64,
    pub get_exchange_rate_result: GetExchangeRateResult,
}

#[update]
pub async fn fetch_xrc_btc_usd_exchange_rate_snapshot(
) -> Result<GetExchangeRateResult, VolumetricError> {
    is_whitelisted()?;
    oracle::fetch_xrc_btc_usd_exchange_rate_snapshot_raw().await
}

#[update]
pub async fn fetch_xrc_btc_usd_exchange_rate_for_settlement_time(
    settlement_time_seconds: u64,
) -> Result<XrcSettlementTimeProbe, VolumetricError> {
    is_whitelisted()?;
    let (xrc_request_timestamp_seconds, get_exchange_rate_result) =
        oracle::fetch_xrc_btc_usd_exchange_rate_for_settlement_time_raw(settlement_time_seconds)
            .await?;
    Ok(XrcSettlementTimeProbe {
        settlement_time_seconds,
        xrc_request_timestamp_seconds,
        get_exchange_rate_result,
    })
}

#[update]
pub async fn fetch_and_store_xrc_btc_usd_exchange_rate_snapshot(
) -> Result<StoredXrcBtcUsdRate, VolumetricError> {
    is_whitelisted()?;
    oracle::fetch_and_store_xrc_btc_usd_exchange_rate_snapshot().await
}

#[query(guard = "no_replicated_call")]
pub fn get_latest_xrc_btc_usd_rate() -> Option<StoredXrcBtcUsdRate> {
    storage_get_latest_xrc_btc_usd_rate()
}

#[query(guard = "no_replicated_call")]
pub fn get_xrc_btc_usd_rate_by_timestamp(
    xrc_timestamp_seconds: u64,
) -> Result<Option<StoredXrcBtcUsdRate>, VolumetricError> {
    is_whitelisted()?;
    Ok(storage_get_xrc_btc_usd_rate(xrc_timestamp_seconds))
}

#[query(guard = "no_replicated_call")]
pub fn list_cached_xrc_btc_usd_rates(
    limit: Option<u32>,
) -> Result<Vec<StoredXrcBtcUsdRate>, VolumetricError> {
    is_whitelisted()?;
    let bounded_limit = limit
        .unwrap_or(DEFAULT_XRC_RATE_LIST_LIMIT)
        .min(MAX_XRC_RATE_LIST_LIMIT);
    Ok(storage_list_xrc_btc_usd_rates(bounded_limit))
}

#[update]
pub fn prune_xrc_btc_usd_rates_before(
    cutoff_timestamp_seconds: u64,
) -> Result<u64, VolumetricError> {
    is_controller()?;
    Ok(delete_xrc_btc_usd_rates_before(cutoff_timestamp_seconds))
}

#[update]
pub fn prune_old_xrc_btc_usd_rates() -> Result<u64, VolumetricError> {
    is_controller()?;
    Ok(cleanup_old_xrc_btc_usd_rates())
}

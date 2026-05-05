use ic_cdk::update;

use crate::errors::VolumetricError;
use crate::generated::xrc::GetExchangeRateResult;
use crate::guards::is_whitelisted;
use crate::oracle;

#[update]
pub async fn fetch_xrc_btc_usd_exchange_rate_snapshot(
) -> Result<GetExchangeRateResult, VolumetricError> {
    is_whitelisted()?;
    oracle::fetch_xrc_btc_usd_exchange_rate_snapshot_raw().await
}

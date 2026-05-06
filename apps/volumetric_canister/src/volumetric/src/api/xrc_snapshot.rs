use ic_cdk::query;

use crate::guards::no_replicated_call;
use crate::storage::{
    get_latest_xrc_btc_usd_rate as storage_get_latest_xrc_btc_usd_rate, StoredXrcBtcUsdRate,
};

#[query(guard = "no_replicated_call")]
pub fn get_latest_xrc_btc_usd_rate() -> Option<StoredXrcBtcUsdRate> {
    storage_get_latest_xrc_btc_usd_rate()
}

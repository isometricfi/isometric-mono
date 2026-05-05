use std::cell::RefCell;

use candid::CandidType;
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::StableBTreeMap;
use serde::{Deserialize, Serialize};

use super::cbor::Cbor;
use super::state::{Memory, MemoryIndex, MEMORY_MANAGER};

thread_local! {
    pub static XRC_BTC_USD_RATES: RefCell<StableBTreeMap<u64, Cbor<StoredXrcBtcUsdRate>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::XrcBtcUsdRatesMemory as u8))),
        )
    );
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, CandidType)]
pub struct StoredXrcBtcUsdRate {
    pub xrc_timestamp_seconds: u64,
    pub fetched_at_seconds: u64,
    pub rate: u64,
    pub decimals: u32,
    pub price_cents: u64,
    pub forex_timestamp: Option<u64>,
    pub quote_asset_num_received_rates: u64,
    pub base_asset_num_received_rates: u64,
    pub base_asset_num_queried_sources: u64,
    pub quote_asset_num_queried_sources: u64,
    pub standard_deviation: u64,
}

pub fn insert_xrc_btc_usd_rate(rate: StoredXrcBtcUsdRate) {
    XRC_BTC_USD_RATES.with_borrow_mut(|rates| {
        rates.insert(rate.xrc_timestamp_seconds, Cbor(rate));
    });
}

pub fn get_xrc_btc_usd_rate(xrc_timestamp_seconds: u64) -> Option<StoredXrcBtcUsdRate> {
    XRC_BTC_USD_RATES.with_borrow(|rates| rates.get(&xrc_timestamp_seconds).map(|rate| rate.0))
}

pub fn get_latest_xrc_btc_usd_rate() -> Option<StoredXrcBtcUsdRate> {
    XRC_BTC_USD_RATES.with_borrow(|rates| rates.iter().next_back().map(|entry| entry.value().0))
}

pub fn list_xrc_btc_usd_rates(limit: u32) -> Vec<StoredXrcBtcUsdRate> {
    XRC_BTC_USD_RATES.with_borrow(|rates| {
        rates
            .iter()
            .rev()
            .take(limit as usize)
            .map(|entry| entry.value().0)
            .collect()
    })
}

pub fn delete_xrc_btc_usd_rates_before(cutoff_timestamp_seconds: u64) -> u64 {
    XRC_BTC_USD_RATES.with_borrow_mut(|rates| {
        let keys_to_remove: Vec<u64> = rates
            .iter()
            .filter_map(|entry| {
                if *entry.key() < cutoff_timestamp_seconds {
                    Some(*entry.key())
                } else {
                    None
                }
            })
            .collect();

        let deleted_count = keys_to_remove.len() as u64;
        for key in keys_to_remove {
            rates.remove(&key);
        }
        deleted_count
    })
}

#[cfg(test)]
pub fn clear_xrc_btc_usd_rates() {
    XRC_BTC_USD_RATES.with_borrow_mut(|rates| {
        let keys: Vec<u64> = rates.iter().map(|entry| *entry.key()).collect();
        for key in keys {
            rates.remove(&key);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIRST_TIMESTAMP_SECONDS: u64 = 1_800;
    const SECOND_TIMESTAMP_SECONDS: u64 = 3_600;
    const THIRD_TIMESTAMP_SECONDS: u64 = 5_400;
    const TEST_FETCHED_AT_SECONDS: u64 = 10_000;
    const TEST_RATE: u64 = 100_000_000_000_000;
    const TEST_DECIMALS: u32 = 9;
    const TEST_PRICE_CENTS: u64 = 10_000_000;
    const TEST_SOURCE_COUNT: u64 = 4;
    const TEST_STANDARD_DEVIATION: u64 = 12;

    fn make_rate(xrc_timestamp_seconds: u64) -> StoredXrcBtcUsdRate {
        StoredXrcBtcUsdRate {
            xrc_timestamp_seconds,
            fetched_at_seconds: TEST_FETCHED_AT_SECONDS,
            rate: TEST_RATE,
            decimals: TEST_DECIMALS,
            price_cents: TEST_PRICE_CENTS,
            forex_timestamp: None,
            quote_asset_num_received_rates: TEST_SOURCE_COUNT,
            base_asset_num_received_rates: TEST_SOURCE_COUNT,
            base_asset_num_queried_sources: TEST_SOURCE_COUNT,
            quote_asset_num_queried_sources: TEST_SOURCE_COUNT,
            standard_deviation: TEST_STANDARD_DEVIATION,
        }
    }

    /// Given: a stored BTC/USD XRC rate
    /// When: looking it up by XRC timestamp
    /// Then: the exact cached rate is returned
    #[test]
    fn should_get_xrc_btc_usd_rate_by_exact_timestamp() {
        // given
        clear_xrc_btc_usd_rates();
        let rate = make_rate(FIRST_TIMESTAMP_SECONDS);
        insert_xrc_btc_usd_rate(rate.clone());

        // when
        let stored_rate = get_xrc_btc_usd_rate(FIRST_TIMESTAMP_SECONDS);

        // then
        assert_eq!(stored_rate, Some(rate));
    }

    /// Given: several stored BTC/USD XRC rates
    /// When: asking for the latest rate
    /// Then: the rate with the highest XRC timestamp is returned
    #[test]
    fn should_get_latest_xrc_btc_usd_rate() {
        // given
        clear_xrc_btc_usd_rates();
        insert_xrc_btc_usd_rate(make_rate(FIRST_TIMESTAMP_SECONDS));
        insert_xrc_btc_usd_rate(make_rate(THIRD_TIMESTAMP_SECONDS));
        insert_xrc_btc_usd_rate(make_rate(SECOND_TIMESTAMP_SECONDS));

        // when
        let latest_rate = get_latest_xrc_btc_usd_rate();

        // then
        assert_eq!(
            latest_rate.map(|rate| rate.xrc_timestamp_seconds),
            Some(THIRD_TIMESTAMP_SECONDS)
        );
    }

    /// Given: more stored BTC/USD XRC rates than the requested limit
    /// When: listing cached rates
    /// Then: the newest rates are returned first up to the limit
    #[test]
    fn should_list_xrc_btc_usd_rates_newest_first_with_limit() {
        // given
        clear_xrc_btc_usd_rates();
        insert_xrc_btc_usd_rate(make_rate(FIRST_TIMESTAMP_SECONDS));
        insert_xrc_btc_usd_rate(make_rate(SECOND_TIMESTAMP_SECONDS));
        insert_xrc_btc_usd_rate(make_rate(THIRD_TIMESTAMP_SECONDS));

        // when
        let rates = list_xrc_btc_usd_rates(2);

        // then
        let expected_timestamps_seconds = vec![THIRD_TIMESTAMP_SECONDS, SECOND_TIMESTAMP_SECONDS];
        let actual_timestamps_seconds: Vec<u64> = rates
            .into_iter()
            .map(|rate| rate.xrc_timestamp_seconds)
            .collect();
        assert_eq!(actual_timestamps_seconds, expected_timestamps_seconds);
    }

    /// Given: cached rates on both sides of a retention cutoff
    /// When: deleting rates before the cutoff
    /// Then: only older rates are removed
    #[test]
    fn should_delete_xrc_btc_usd_rates_before_cutoff() {
        // given
        clear_xrc_btc_usd_rates();
        insert_xrc_btc_usd_rate(make_rate(FIRST_TIMESTAMP_SECONDS));
        insert_xrc_btc_usd_rate(make_rate(SECOND_TIMESTAMP_SECONDS));
        insert_xrc_btc_usd_rate(make_rate(THIRD_TIMESTAMP_SECONDS));

        // when
        let deleted_count = delete_xrc_btc_usd_rates_before(SECOND_TIMESTAMP_SECONDS);

        // then
        const EXPECTED_DELETED_COUNT: u64 = 1;
        assert_eq!(deleted_count, EXPECTED_DELETED_COUNT);
        assert!(get_xrc_btc_usd_rate(FIRST_TIMESTAMP_SECONDS).is_none());
        assert!(get_xrc_btc_usd_rate(SECOND_TIMESTAMP_SECONDS).is_some());
        assert!(get_xrc_btc_usd_rate(THIRD_TIMESTAMP_SECONDS).is_some());
    }
}

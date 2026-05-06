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
    pub price_cents: u64,
    pub decimals: u32,
}

pub fn insert_xrc_btc_usd_rate(rate: StoredXrcBtcUsdRate) {
    XRC_BTC_USD_RATES.with_borrow_mut(|rates| {
        rates.insert(rate.xrc_timestamp_seconds, Cbor(rate));
    });
}

pub fn get_xrc_btc_usd_rate(xrc_timestamp_seconds: u64) -> Option<StoredXrcBtcUsdRate> {
    XRC_BTC_USD_RATES.with_borrow(|rates| rates.get(&xrc_timestamp_seconds).map(|rate| rate.0))
}

pub fn get_nearest_xrc_btc_usd_rate_within_seconds(
    target_timestamp_seconds: u64,
    max_delta_seconds: u64,
) -> Option<StoredXrcBtcUsdRate> {
    XRC_BTC_USD_RATES.with_borrow(|rates| {
        rates
            .iter()
            .filter_map(|entry| {
                let xrc_timestamp_seconds = *entry.key();
                let delta_seconds = xrc_timestamp_seconds.abs_diff(target_timestamp_seconds);
                if delta_seconds > max_delta_seconds {
                    return None;
                }
                Some((delta_seconds, xrc_timestamp_seconds, entry.value().0))
            })
            .min_by_key(|(delta_seconds, xrc_timestamp_seconds, _)| {
                (*delta_seconds, *xrc_timestamp_seconds)
            })
            .map(|(_, _, rate)| rate)
    })
}

pub fn get_latest_xrc_btc_usd_rate() -> Option<StoredXrcBtcUsdRate> {
    XRC_BTC_USD_RATES.with_borrow(|rates| rates.iter().next_back().map(|entry| entry.value().0))
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
    const TEST_DECIMALS: u32 = 9;
    const TEST_PRICE_CENTS: u64 = 10_000_000;
    const ONE_MINUTE_SECONDS: u64 = 60;
    const MAX_DELTA_30_MINUTES_SECONDS: u64 = 30 * ONE_MINUTE_SECONDS;

    fn make_rate(xrc_timestamp_seconds: u64) -> StoredXrcBtcUsdRate {
        make_rate_with_price(xrc_timestamp_seconds, TEST_PRICE_CENTS)
    }

    fn make_rate_with_price(xrc_timestamp_seconds: u64, price_cents: u64) -> StoredXrcBtcUsdRate {
        StoredXrcBtcUsdRate {
            xrc_timestamp_seconds,
            fetched_at_seconds: TEST_FETCHED_AT_SECONDS,
            price_cents,
            decimals: TEST_DECIMALS,
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

    /// Given: cached rates including an exact timestamp match
    /// When: asking for the nearest rate within a 30-minute window
    /// Then: the exact match is returned
    #[test]
    fn should_get_exact_xrc_btc_usd_rate_as_nearest_match() {
        // given
        clear_xrc_btc_usd_rates();
        const TARGET_TIMESTAMP_SECONDS: u64 = 10 * 3_600;
        const EXPECTED_PRICE_CENTS: u64 = 11_000_000;
        insert_xrc_btc_usd_rate(make_rate(TARGET_TIMESTAMP_SECONDS - 5 * ONE_MINUTE_SECONDS));
        insert_xrc_btc_usd_rate(make_rate_with_price(
            TARGET_TIMESTAMP_SECONDS,
            EXPECTED_PRICE_CENTS,
        ));

        // when
        let nearest_rate = get_nearest_xrc_btc_usd_rate_within_seconds(
            TARGET_TIMESTAMP_SECONDS,
            MAX_DELTA_30_MINUTES_SECONDS,
        );

        // then
        assert_eq!(
            nearest_rate.map(|rate| rate.price_cents),
            Some(EXPECTED_PRICE_CENTS)
        );
    }

    /// Given: cached rates before the target timestamp
    /// When: asking for the nearest rate within a 30-minute window
    /// Then: the closest earlier rate is returned
    #[test]
    fn should_get_closest_before_xrc_btc_usd_rate_within_window() {
        // given
        clear_xrc_btc_usd_rates();
        const TARGET_TIMESTAMP_SECONDS: u64 = 20 * 3_600;
        const EXPECTED_TIMESTAMP_SECONDS: u64 = TARGET_TIMESTAMP_SECONDS - 13 * ONE_MINUTE_SECONDS;
        insert_xrc_btc_usd_rate(make_rate(
            TARGET_TIMESTAMP_SECONDS - 20 * ONE_MINUTE_SECONDS,
        ));
        insert_xrc_btc_usd_rate(make_rate(EXPECTED_TIMESTAMP_SECONDS));

        // when
        let nearest_rate = get_nearest_xrc_btc_usd_rate_within_seconds(
            TARGET_TIMESTAMP_SECONDS,
            MAX_DELTA_30_MINUTES_SECONDS,
        );

        // then
        assert_eq!(
            nearest_rate.map(|rate| rate.xrc_timestamp_seconds),
            Some(EXPECTED_TIMESTAMP_SECONDS)
        );
    }

    /// Given: cached rates after the target timestamp
    /// When: asking for the nearest rate within a 30-minute window
    /// Then: the closest later rate is returned
    #[test]
    fn should_get_closest_after_xrc_btc_usd_rate_within_window() {
        // given
        clear_xrc_btc_usd_rates();
        const TARGET_TIMESTAMP_SECONDS: u64 = 30 * 3_600;
        const EXPECTED_TIMESTAMP_SECONDS: u64 = TARGET_TIMESTAMP_SECONDS + 8 * ONE_MINUTE_SECONDS;
        insert_xrc_btc_usd_rate(make_rate(EXPECTED_TIMESTAMP_SECONDS));
        insert_xrc_btc_usd_rate(make_rate(
            TARGET_TIMESTAMP_SECONDS + 17 * ONE_MINUTE_SECONDS,
        ));

        // when
        let nearest_rate = get_nearest_xrc_btc_usd_rate_within_seconds(
            TARGET_TIMESTAMP_SECONDS,
            MAX_DELTA_30_MINUTES_SECONDS,
        );

        // then
        assert_eq!(
            nearest_rate.map(|rate| rate.xrc_timestamp_seconds),
            Some(EXPECTED_TIMESTAMP_SECONDS)
        );
    }

    /// Given: cached rates outside the allowed window
    /// When: asking for the nearest rate within a 30-minute window
    /// Then: no cached rate is returned
    #[test]
    fn should_not_get_xrc_btc_usd_rate_outside_window() {
        // given
        clear_xrc_btc_usd_rates();
        const TARGET_TIMESTAMP_SECONDS: u64 = 40 * 3_600;
        insert_xrc_btc_usd_rate(make_rate(
            TARGET_TIMESTAMP_SECONDS - 31 * ONE_MINUTE_SECONDS,
        ));
        insert_xrc_btc_usd_rate(make_rate(
            TARGET_TIMESTAMP_SECONDS + 31 * ONE_MINUTE_SECONDS,
        ));

        // when
        let nearest_rate = get_nearest_xrc_btc_usd_rate_within_seconds(
            TARGET_TIMESTAMP_SECONDS,
            MAX_DELTA_30_MINUTES_SECONDS,
        );

        // then
        assert!(nearest_rate.is_none());
    }

    /// Given: equally close cached rates before and after the target timestamp
    /// When: asking for the nearest rate within a 30-minute window
    /// Then: the earlier timestamp is returned deterministically
    #[test]
    fn should_prefer_earlier_xrc_btc_usd_rate_on_equal_distance_tie() {
        // given
        clear_xrc_btc_usd_rates();
        const TARGET_TIMESTAMP_SECONDS: u64 = 50 * 3_600;
        const EARLIER_TIMESTAMP_SECONDS: u64 = TARGET_TIMESTAMP_SECONDS - 10 * ONE_MINUTE_SECONDS;
        const LATER_TIMESTAMP_SECONDS: u64 = TARGET_TIMESTAMP_SECONDS + 10 * ONE_MINUTE_SECONDS;
        insert_xrc_btc_usd_rate(make_rate(LATER_TIMESTAMP_SECONDS));
        insert_xrc_btc_usd_rate(make_rate(EARLIER_TIMESTAMP_SECONDS));

        // when
        let nearest_rate = get_nearest_xrc_btc_usd_rate_within_seconds(
            TARGET_TIMESTAMP_SECONDS,
            MAX_DELTA_30_MINUTES_SECONDS,
        );

        // then
        assert_eq!(
            nearest_rate.map(|rate| rate.xrc_timestamp_seconds),
            Some(EARLIER_TIMESTAMP_SECONDS)
        );
    }
}

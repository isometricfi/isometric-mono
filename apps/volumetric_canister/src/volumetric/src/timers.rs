use std::time::Duration;

use crate::journaling::{cleanup_succeeded, promote_stale_in_flight_to_recovery_required};
use crate::ledger::refresh_transfer_fee_cache_if_idle;
use crate::oracle::fetch_and_store_xrc_btc_usd_exchange_rate_snapshot;
use crate::storage::delete_xrc_btc_usd_rates_before;
use crate::time::current_time_seconds;
use crate::usecases::{cleanup_old_events_use_case, settle_expired_options_use_case};

const TRANSFER_FEE_REFRESH_INTERVAL_SECS: u64 = 60;
const WAL_INFLIGHT_RECOVERY_SCAN_INTERVAL_5_MINUTES_SECS: u64 = 5 * 60;
const XRC_SNAPSHOT_INTERVAL_15_MINUTES_SECS: u64 = 15 * 60;
const ONE_HOUR_SECS: u64 = 60 * 60;
const ONE_DAY_SECS: u64 = 24 * ONE_HOUR_SECS;
const ONE_WEEK_SECS: u64 = 7 * ONE_DAY_SECS;

pub fn setup_timers() {
    setup_transfer_fee_refresh_timer();
    setup_xrc_snapshot_timer();
    setup_xrc_rate_cleanup_timer();
    setup_event_cleanup_timer();
    setup_wal_inflight_recovery_timer();
    setup_settlement_timer();
}

/// Runs daily to delete events older than 1 week, preventing unbounded storage growth.
fn setup_event_cleanup_timer() {
    ic_cdk_timers::set_timer_interval(Duration::from_secs(ONE_DAY_SECS), || async {
        let result = cleanup_old_events_use_case();
        if result.deleted_count > 0 {
            logging::log!("Event cleanup: deleted {} old events", result.deleted_count);
        }
        let removed_wal_entries = cleanup_succeeded();
        if removed_wal_entries > 0 {
            logging::log!(
                "WAL cleanup: removed {} completed entries",
                removed_wal_entries
            );
        }
    });
}

fn setup_transfer_fee_refresh_timer() {
    ic_cdk_timers::set_timer_interval(
        Duration::from_secs(TRANSFER_FEE_REFRESH_INTERVAL_SECS),
        || async {
            refresh_transfer_fee_cache_if_idle().await;
        },
    );
}

fn setup_xrc_snapshot_timer() {
    let initial_delay_seconds = seconds_until_next_xrc_snapshot_tick(current_time_seconds());
    ic_cdk_timers::set_timer(Duration::from_secs(initial_delay_seconds), async {
        refresh_xrc_snapshot_cache().await;
        setup_xrc_snapshot_interval_timer();
    });
}

fn setup_xrc_snapshot_interval_timer() {
    ic_cdk_timers::set_timer_interval(
        Duration::from_secs(XRC_SNAPSHOT_INTERVAL_15_MINUTES_SECS),
        || async {
            refresh_xrc_snapshot_cache().await;
        },
    );
}

async fn refresh_xrc_snapshot_cache() {
    match fetch_and_store_xrc_btc_usd_exchange_rate_snapshot().await {
        Ok(stored_rate) => {
            logging::log!(
                "XRC snapshot cache: stored BTC/USD rate for timestamp {}",
                stored_rate.xrc_timestamp_seconds
            );
        }
        Err(error) => {
            logging::warn!(
                "XRC snapshot cache: failed to refresh BTC/USD rate: {}",
                error
            );
        }
    }
}

fn setup_xrc_rate_cleanup_timer() {
    ic_cdk_timers::set_timer_interval(Duration::from_secs(ONE_DAY_SECS), || async {
        let deleted_count = cleanup_old_xrc_btc_usd_rates();
        if deleted_count > 0 {
            logging::log!(
                "XRC snapshot cleanup: deleted {} old BTC/USD rates",
                deleted_count
            );
        }
    });
}

fn cleanup_old_xrc_btc_usd_rates() -> u64 {
    let cutoff_timestamp_seconds = current_time_seconds().saturating_sub(ONE_WEEK_SECS);
    delete_xrc_btc_usd_rates_before(cutoff_timestamp_seconds)
}

fn seconds_until_next_xrc_snapshot_tick(now_seconds: u64) -> u64 {
    let seconds_since_last_tick = now_seconds % XRC_SNAPSHOT_INTERVAL_15_MINUTES_SECS;
    if seconds_since_last_tick == 0 {
        return 0;
    }
    XRC_SNAPSHOT_INTERVAL_15_MINUTES_SECS - seconds_since_last_tick
}

fn setup_wal_inflight_recovery_timer() {
    ic_cdk_timers::set_timer_interval(
        Duration::from_secs(WAL_INFLIGHT_RECOVERY_SCAN_INTERVAL_5_MINUTES_SECS),
        || async {
            let promoted_entries = promote_stale_in_flight_to_recovery_required();
            if promoted_entries > 0 {
                logging::log!(
                    "WAL recovery scan: promoted {} stale in-flight entries",
                    promoted_entries
                );
            }
        },
    );
}

/// Runs hourly to settle all expired options.
fn setup_settlement_timer() {
    ic_cdk_timers::set_timer_interval(Duration::from_secs(ONE_HOUR_SECS), || async {
        logging::log!("Settlement cron: checking expired options");

        let result = settle_expired_options_use_case().await;
        if result.settled.is_empty() && result.errors.is_empty() {
            logging::log!("Settlement cron: no expired options settled");
            return;
        }

        if !result.settled.is_empty() {
            logging::log!("Settlement cron: settled {} options", result.settled.len());
        }
        if !result.errors.is_empty() {
            logging::error!(
                "Settlement cron: {} errors: {:?}",
                result.errors.len(),
                result.errors
            );
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const ONE_MINUTE_SECS: u64 = 60;

    /// Given: the current time is exactly on a 15-minute boundary
    /// When: calculating the first XRC snapshot timer delay
    /// Then: the timer is due immediately
    #[test]
    fn should_return_zero_delay_on_xrc_snapshot_boundary() {
        // given
        const NOW_SECONDS: u64 = XRC_SNAPSHOT_INTERVAL_15_MINUTES_SECS * 10;

        // when
        let delay_seconds = seconds_until_next_xrc_snapshot_tick(NOW_SECONDS);

        // then
        const EXPECTED_DELAY_SECONDS: u64 = 0;
        assert_eq!(delay_seconds, EXPECTED_DELAY_SECONDS);
    }

    /// Given: the current time is one minute after a 15-minute boundary
    /// When: calculating the first XRC snapshot timer delay
    /// Then: the delay lands on the next 15-minute boundary
    #[test]
    fn should_align_xrc_snapshot_delay_to_next_boundary() {
        // given
        const NOW_SECONDS: u64 = XRC_SNAPSHOT_INTERVAL_15_MINUTES_SECS * 10 + ONE_MINUTE_SECS;

        // when
        let delay_seconds = seconds_until_next_xrc_snapshot_tick(NOW_SECONDS);

        // then
        const EXPECTED_DELAY_SECONDS: u64 = XRC_SNAPSHOT_INTERVAL_15_MINUTES_SECS - ONE_MINUTE_SECS;
        assert_eq!(delay_seconds, EXPECTED_DELAY_SECONDS);
    }
}

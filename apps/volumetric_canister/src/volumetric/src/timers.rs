use std::time::Duration;

use crate::journaling::{
    cleanup_succeeded, collect_due_retry_required_operation_ids, execute_wal_entry_now,
    promote_stale_in_flight_to_recovery_required, OperationId,
};
use crate::ledger::refresh_transfer_fee_cache_if_idle;
use crate::oracle::fetch_and_store_xrc_btc_usd_exchange_rate_snapshot;
use crate::storage::delete_xrc_btc_usd_rates_before;
use crate::time::current_time_seconds;
use crate::usecases::{cleanup_old_events_use_case, settle_expired_options_use_case};

const TRANSFER_FEE_REFRESH_INTERVAL_SECS: u64 = 60;
const WAL_MAINTENANCE_SCAN_INTERVAL_5_MINUTES_SECS: u64 = 5 * 60;
const WAL_AUTO_RETRY_MAX_ENTRIES_PER_SCAN: usize = 20;
const XRC_SNAPSHOT_INTERVAL_5_MINUTES_SECS: u64 = 5 * 60;
const ONE_HOUR_SECS: u64 = 60 * 60;
const ONE_DAY_SECS: u64 = 24 * ONE_HOUR_SECS;
const ONE_WEEK_SECS: u64 = 7 * ONE_DAY_SECS;

pub fn setup_timers() {
    // Periodically refreshes the ICRC transfer fee cache when the ledger client is idle.
    setup_transfer_fee_refresh_timer();

    // Aligns to 5-minute ticks, then fetches a current BTC/USD snapshot from XRC into stable cache.
    setup_xrc_snapshot_timer();

    // Once per day, removes XRC cache entries older than one week.
    setup_xrc_rate_cleanup_timer();

    // Once per day, deletes domain events older than one week and prunes completed WAL rows.
    setup_event_cleanup_timer();

    // Every five minutes: promote stale in-flight WAL rows to recovery-required, then drain due auto-retries.
    setup_wal_maintenance_scan_timer();

    // Every hour, runs settlement for expired options.
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
        Duration::from_secs(XRC_SNAPSHOT_INTERVAL_5_MINUTES_SECS),
        || async {
            refresh_xrc_snapshot_cache().await;
        },
    );
}

async fn refresh_xrc_snapshot_cache() {
    match fetch_and_store_xrc_btc_usd_exchange_rate_snapshot().await {
        Ok(stored_rate) => {
            logging::log!(
                "XRC snapshot timer (5m): stored BTC/USD rate for timestamp {}",
                stored_rate.xrc_timestamp_seconds
            );
        }
        Err(error) => {
            logging::warn!(
                "XRC snapshot timer (5m): failed to refresh BTC/USD rate: {}",
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
    let seconds_since_last_tick = now_seconds % XRC_SNAPSHOT_INTERVAL_5_MINUTES_SECS;
    if seconds_since_last_tick == 0 {
        return 0;
    }
    XRC_SNAPSHOT_INTERVAL_5_MINUTES_SECS - seconds_since_last_tick
}

fn setup_wal_maintenance_scan_timer() {
    ic_cdk_timers::set_timer_interval(
        Duration::from_secs(WAL_MAINTENANCE_SCAN_INTERVAL_5_MINUTES_SECS),
        || async {
            let promoted_stale_in_flight = promote_stale_in_flight_to_recovery_required();
            let retry_outcome = retry_due_wal_entries_once().await;
            if promoted_stale_in_flight > 0
                || retry_outcome.promoted_to_recovery_required > 0
                || retry_outcome.retried_count > 0
            {
                logging::log!(
                    "WAL maintenance timer (5m): work completed (stale_in_flight_promoted={} retry_queue_promoted_to_recovery={} entries_retried={})",
                    promoted_stale_in_flight,
                    retry_outcome.promoted_to_recovery_required,
                    retry_outcome.retried_count,
                );
            }
        },
    );
}

pub(crate) struct WalRetryTickOutcome {
    pub promoted_to_recovery_required: u64,
    pub retried_count: usize,
}

pub(crate) async fn retry_due_wal_entries_once() -> WalRetryTickOutcome {
    let retry_drain = collect_due_retry_required_operation_ids(WAL_AUTO_RETRY_MAX_ENTRIES_PER_SCAN);
    if retry_drain.promoted_to_recovery_required > 0 {
        logging::warn!(
            "WAL auto-retry: moved {} exhausted or expired entries to manual recovery",
            retry_drain.promoted_to_recovery_required
        );
    }

    if retry_drain.operation_ids.is_empty() {
        return WalRetryTickOutcome {
            promoted_to_recovery_required: retry_drain.promoted_to_recovery_required,
            retried_count: 0,
        };
    }

    let retried_count = retry_drain.operation_ids.len();

    // WAL iteration order from storage is stable; without varying who runs first, one entry that
    // traps mid-scan can repeatedly prevent later operation_ids from running that tick. Rotating by
    // current_time_seconds mod len spreads first position across scans at negligible cost.
    let mut operation_ids = retry_drain.operation_ids;
    rotate_wal_auto_retry_operation_ids_by_time(&mut operation_ids);

    for operation_id in operation_ids {
        let outcome = execute_wal_entry_now(operation_id).await;
        logging::log!(
            "WAL auto-retry: operation_id={:?} outcome={:?}",
            operation_id,
            outcome
        );
    }

    WalRetryTickOutcome {
        promoted_to_recovery_required: retry_drain.promoted_to_recovery_required,
        retried_count,
    }
}

fn rotate_wal_auto_retry_operation_ids_for_time(
    operation_ids: &mut Vec<OperationId>,
    now_seconds: u64,
) {
    let len = operation_ids.len();
    if len <= 1 {
        return;
    }
    let rotate_by = (now_seconds as usize) % len;
    operation_ids.rotate_left(rotate_by);
}

fn rotate_wal_auto_retry_operation_ids_by_time(operation_ids: &mut Vec<OperationId>) {
    rotate_wal_auto_retry_operation_ids_for_time(operation_ids, current_time_seconds());
}

/// Runs hourly to settle all expired options.
fn setup_settlement_timer() {
    ic_cdk_timers::set_timer_interval(Duration::from_secs(ONE_HOUR_SECS), || async {
        logging::log!("Settlement timer (1h): checking expired options");

        let result = settle_expired_options_use_case().await;
        if result.settled.is_empty() && result.errors.is_empty() {
            logging::log!("Settlement timer (1h): no expired options settled");
            return;
        }

        if !result.settled.is_empty() {
            logging::log!(
                "Settlement timer (1h): settled {} options",
                result.settled.len()
            );
        }
        if !result.errors.is_empty() {
            logging::error!(
                "Settlement timer (1h): {} errors: {:?}",
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

    /// Given: the current time is exactly on a 5-minute boundary
    /// When: calculating the first XRC snapshot timer delay
    /// Then: the timer is due immediately
    #[test]
    fn should_return_zero_delay_on_xrc_snapshot_boundary() {
        // given
        const NOW_SECONDS: u64 = XRC_SNAPSHOT_INTERVAL_5_MINUTES_SECS * 10;

        // when
        let delay_seconds = seconds_until_next_xrc_snapshot_tick(NOW_SECONDS);

        // then
        const EXPECTED_DELAY_SECONDS: u64 = 0;
        assert_eq!(delay_seconds, EXPECTED_DELAY_SECONDS);
    }

    /// Given: the current time is one minute after a 5-minute boundary
    /// When: calculating the first XRC snapshot timer delay
    /// Then: the delay lands on the next 5-minute boundary
    #[test]
    fn should_align_xrc_snapshot_delay_to_next_boundary() {
        // given
        const NOW_SECONDS: u64 = XRC_SNAPSHOT_INTERVAL_5_MINUTES_SECS * 10 + ONE_MINUTE_SECS;

        // when
        let delay_seconds = seconds_until_next_xrc_snapshot_tick(NOW_SECONDS);

        // then
        const EXPECTED_DELAY_SECONDS: u64 = XRC_SNAPSHOT_INTERVAL_5_MINUTES_SECS - ONE_MINUTE_SECS;
        assert_eq!(delay_seconds, EXPECTED_DELAY_SECONDS);
    }

    /// Given: three distinct WAL operation ids and a fixed `now_seconds` whose value mod 3 is 1
    /// When: applying WAL auto-retry time rotation for that timestamp
    /// Then: the list is rotated left by one so the former head moves after the tail
    #[test]
    fn should_rotate_wal_auto_retry_order_by_current_time_seconds() {
        // given
        const NOW_SECONDS: u64 = 100;
        const ENTRY_COUNT: usize = 3;
        const EXPECTED_ROTATE_BY: usize = 1;
        assert_eq!(
            NOW_SECONDS as usize % ENTRY_COUNT,
            EXPECTED_ROTATE_BY,
            "test expects rotate_by=1 for three entries"
        );

        let mut operation_ids = vec![
            make_rotate_test_operation_id(0),
            make_rotate_test_operation_id(1),
            make_rotate_test_operation_id(2),
        ];

        // when
        rotate_wal_auto_retry_operation_ids_for_time(&mut operation_ids, NOW_SECONDS);

        // then
        let expected_order = vec![
            make_rotate_test_operation_id(1),
            make_rotate_test_operation_id(2),
            make_rotate_test_operation_id(0),
        ];
        assert_eq!(operation_ids, expected_order);
    }

    /// Given: three WAL operation ids and a fixed `now_seconds` whose value mod 3 is 0
    /// When: applying WAL auto-retry time rotation for that timestamp
    /// Then: the order is unchanged
    #[test]
    fn should_leave_wal_auto_retry_order_unchanged_when_rotation_offset_is_zero() {
        // given
        const NOW_SECONDS: u64 = 99;

        let mut operation_ids = vec![
            make_rotate_test_operation_id(0),
            make_rotate_test_operation_id(1),
            make_rotate_test_operation_id(2),
        ];
        let expected_order = operation_ids.clone();

        // when
        rotate_wal_auto_retry_operation_ids_for_time(&mut operation_ids, NOW_SECONDS);

        // then
        assert_eq!(operation_ids, expected_order);
    }

    fn make_rotate_test_operation_id(seed: u8) -> OperationId {
        OperationId::from_parts(&[b"wal-retry-rotate-test", &[seed]])
    }
}

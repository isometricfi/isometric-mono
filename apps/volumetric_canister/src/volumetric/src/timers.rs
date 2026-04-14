use std::time::Duration;

use crate::journaling::{cleanup_succeeded, promote_stale_in_flight_to_recovery_required};
use crate::ledger::refresh_transfer_fee_cache_if_idle;
use crate::usecases::{cleanup_old_events_use_case, settle_expired_options_use_case};

const TRANSFER_FEE_REFRESH_INTERVAL_SECS: u64 = 60;
const WAL_INFLIGHT_RECOVERY_SCAN_INTERVAL_5_MINUTES_SECS: u64 = 5 * 60;
const ONE_HOUR_SECS: u64 = 60 * 60;
const ONE_DAY_SECS: u64 = 24 * ONE_HOUR_SECS;

pub fn setup_timers() {
    setup_transfer_fee_refresh_timer();
    setup_event_cleanup_timer();
    setup_wal_inflight_recovery_timer();
    setup_settlement_timer();
}

/// Runs daily to delete events older than 1 week, preventing unbounded storage growth.
fn setup_event_cleanup_timer() {
    ic_cdk_timers::set_timer_interval(Duration::from_secs(ONE_DAY_SECS), || async {
        let result = cleanup_old_events_use_case();
        if result.deleted_count > 0 {
            ic_cdk::println!("Event cleanup: deleted {} old events", result.deleted_count);
        }
        let removed_wal_entries = cleanup_succeeded();
        if removed_wal_entries > 0 {
            ic_cdk::println!(
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

fn setup_wal_inflight_recovery_timer() {
    ic_cdk_timers::set_timer_interval(
        Duration::from_secs(WAL_INFLIGHT_RECOVERY_SCAN_INTERVAL_5_MINUTES_SECS),
        || async {
            let promoted_entries = promote_stale_in_flight_to_recovery_required();
            if promoted_entries > 0 {
                ic_cdk::println!(
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
        let result = settle_expired_options_use_case().await;
        if !result.settled.is_empty() {
            ic_cdk::println!("Settlement cron: settled {} options", result.settled.len());
        }
        if !result.errors.is_empty() {
            ic_cdk::println!(
                "Settlement cron: {} errors: {:?}",
                result.errors.len(),
                result.errors
            );
        }
    });
}

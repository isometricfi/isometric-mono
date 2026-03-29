use std::time::Duration;

use crate::journaling::{cleanup_succeeded, retry_all_due};
use crate::ledger::refresh_transfer_fee_cache_if_idle;
use crate::usecases::{cleanup_old_events_use_case, settle_expired_options_use_case};

const WAL_RETRY_INTERVAL_SECS: u64 = 10;
const TRANSFER_FEE_REFRESH_INTERVAL_SECS: u64 = 60;
const ONE_HOUR_SECS: u64 = 60 * 60;
const ONE_DAY_SECS: u64 = 24 * ONE_HOUR_SECS;

pub fn setup_timers() {
    setup_transfer_fee_refresh_timer();
    setup_event_cleanup_timer();
    setup_wal_retry_timer();
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

fn setup_wal_retry_timer() {
    ic_cdk_timers::set_timer_interval(Duration::from_secs(WAL_RETRY_INTERVAL_SECS), || async {
        retry_all_due().await;
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

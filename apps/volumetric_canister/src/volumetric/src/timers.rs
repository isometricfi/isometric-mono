use std::time::Duration;

use crate::usecases::cleanup_old_events_use_case;

const ONE_DAY_SECS: u64 = 24 * 60 * 60;

pub fn setup_timers() {
    setup_event_cleanup_timer();
    setup_settlement_timer();
}

/// Runs daily to delete events older than 1 week, preventing unbounded storage growth.
fn setup_event_cleanup_timer() {
    ic_cdk_timers::set_timer_interval(Duration::from_secs(ONE_DAY_SECS), || {
        let result = cleanup_old_events_use_case();
        if result.deleted_count > 0 {
            ic_cdk::println!("Event cleanup: deleted {} old events", result.deleted_count);
        }
    });
}

/// Disabled for testing - manually call settle_expired_options() or settle_option_by_id().
fn setup_settlement_timer() {}

use crate::ic;
use crate::storage::delete_events_before;

const ONE_WEEK_NS: u64 = 7 * 24 * 60 * 60 * 1_000_000_000;

pub struct CleanupEventsResult {
    pub deleted_count: u64,
}

pub fn cleanup_old_events_use_case() -> CleanupEventsResult {
    let now = ic::time();
    let cutoff = now.saturating_sub(ONE_WEEK_NS);
    let deleted_count = delete_events_before(cutoff);
    CleanupEventsResult { deleted_count }
}

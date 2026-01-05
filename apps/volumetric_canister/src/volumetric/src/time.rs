/// Time utilities for option expiry calculations.

const NANOS_PER_SECOND: u64 = 1_000_000_000;
const SECONDS_PER_HOUR: u64 = 3600;
const NANOS_PER_HOUR: u64 = SECONDS_PER_HOUR * NANOS_PER_SECOND;

/// Rounds a nanosecond timestamp up to the next hour boundary.
/// If the timestamp is already exactly on the hour, it returns the next hour.
///
/// This ensures that options always have at least their full duration,
/// and all expiries land on hour boundaries for efficient batch settlement.
pub fn round_up_to_next_hour_ns(timestamp_ns: u64) -> u64 {
    // Integer division rounds down, so we add (NANOS_PER_HOUR - 1) before dividing
    // to effectively round up. Then multiply back to get the hour boundary.
    let next_hour = ((timestamp_ns / NANOS_PER_HOUR) + 1) * NANOS_PER_HOUR;
    next_hour
}

/// Calculates the option expiry given the current time and duration.
///
/// The logic:
/// 1. Round the current time up to the next hour (effective start time)
/// 2. Add the full duration to that rounded start time
///
/// This guarantees the user gets at least their full duration,
/// and the expiry always lands on an hour boundary.
pub fn calculate_expiry_ns(now_ns: u64, duration_seconds: u64) -> Option<u64> {
    let effective_start = round_up_to_next_hour_ns(now_ns);
    let duration_nanos = duration_seconds.checked_mul(NANOS_PER_SECOND)?;
    effective_start.checked_add(duration_nanos)
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOUR_ALIGNED_BASE: u64 = 277 * NANOS_PER_HOUR;
    const ONE_HOUR: u64 = NANOS_PER_HOUR;
    const SECONDS_45_MINS: u64 = 45 * 60;
    const SECONDS_1_HOUR: u64 = 3600;
    const SECONDS_24_HOURS: u64 = 24 * 3600;
    const SECONDS_7_DAYS: u64 = 7 * 24 * 3600;

    #[test]
    fn test_round_up_mid_hour() {
        // given
        let offset_45m_30s = (45 * 60 + 30) * NANOS_PER_SECOND;
        let timestamp = HOUR_ALIGNED_BASE + offset_45m_30s;

        // when
        let rounded = round_up_to_next_hour_ns(timestamp);

        // then
        let expected = HOUR_ALIGNED_BASE + ONE_HOUR;
        assert_eq!(rounded, expected);
    }

    #[test]
    fn test_round_up_exactly_on_hour() {
        // given
        let timestamp = HOUR_ALIGNED_BASE;

        // when
        let rounded = round_up_to_next_hour_ns(timestamp);

        // then
        let expected = HOUR_ALIGNED_BASE + ONE_HOUR;
        assert_eq!(rounded, expected);
    }

    #[test]
    fn test_round_up_one_nano_past_hour() {
        // given
        let timestamp = HOUR_ALIGNED_BASE + 1;

        // when
        let rounded = round_up_to_next_hour_ns(timestamp);

        // then
        let expected = HOUR_ALIGNED_BASE + ONE_HOUR;
        assert_eq!(rounded, expected);
    }

    #[test]
    fn test_round_up_one_nano_before_hour() {
        // given
        let timestamp = HOUR_ALIGNED_BASE + ONE_HOUR - 1;

        // when
        let rounded = round_up_to_next_hour_ns(timestamp);

        // then
        let expected = HOUR_ALIGNED_BASE + ONE_HOUR;
        assert_eq!(rounded, expected);
    }

    #[test]
    fn test_expiry_1_hour_duration() {
        // given
        let now = HOUR_ALIGNED_BASE + SECONDS_45_MINS * NANOS_PER_SECOND;
        let duration_seconds = SECONDS_1_HOUR;

        // when
        let expiry = calculate_expiry_ns(now, duration_seconds).unwrap();

        // then
        let expected = HOUR_ALIGNED_BASE + 2 * ONE_HOUR;
        assert_eq!(expiry, expected);
    }

    #[test]
    fn test_expiry_24_hour_duration() {
        // given
        let now = HOUR_ALIGNED_BASE + SECONDS_45_MINS * NANOS_PER_SECOND;
        let duration_seconds = SECONDS_24_HOURS;

        // when
        let expiry = calculate_expiry_ns(now, duration_seconds).unwrap();

        // then
        let expected = HOUR_ALIGNED_BASE + 25 * ONE_HOUR;
        assert_eq!(expiry, expected);
    }

    #[test]
    fn test_expiry_7_day_duration() {
        // given
        let now = HOUR_ALIGNED_BASE + SECONDS_45_MINS * NANOS_PER_SECOND;
        let duration_seconds = SECONDS_7_DAYS;

        // when
        let expiry = calculate_expiry_ns(now, duration_seconds).unwrap();

        // then
        let hours_in_7_days = 7 * 24;
        let expected = HOUR_ALIGNED_BASE + (1 + hours_in_7_days) * ONE_HOUR;
        assert_eq!(expiry, expected);
    }

    #[test]
    fn test_expiry_on_hour_gets_full_duration() {
        // given
        let now = HOUR_ALIGNED_BASE;
        let duration_seconds = SECONDS_1_HOUR;

        // when
        let expiry = calculate_expiry_ns(now, duration_seconds).unwrap();

        // then
        let expected = HOUR_ALIGNED_BASE + 2 * ONE_HOUR;
        assert_eq!(expiry, expected);
    }
}

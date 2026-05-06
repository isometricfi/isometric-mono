/// Time utilities for option expiry calculations.
use crate::ic;

pub const NANOS_PER_SECOND: u64 = 1_000_000_000;
const SECONDS_PER_HOUR: u64 = 3600;

pub fn current_time_seconds() -> u64 {
    nanos_to_seconds(ic::time())
}

pub fn nanos_to_seconds(timestamp_ns: u64) -> u64 {
    timestamp_ns / NANOS_PER_SECOND
}

pub fn seconds_to_nanos_for_external_api(timestamp_seconds: u64) -> Option<u64> {
    timestamp_seconds.checked_mul(NANOS_PER_SECOND)
}

/// Rounds a seconds timestamp up to the next hour boundary.
/// If the timestamp is already exactly on the hour, it returns the next hour.
///
/// This ensures that options always have at least their full duration,
/// and all expiries land on hour boundaries for efficient batch settlement.
pub fn round_up_to_next_hour_seconds(timestamp_seconds: u64) -> Option<u64> {
    (timestamp_seconds / SECONDS_PER_HOUR)
        .checked_add(1)?
        .checked_mul(SECONDS_PER_HOUR)
}

/// Calculates the option expiry given the current time and duration.
///
/// The logic:
/// 1. Round the current time up to the next hour (effective start time)
/// 2. Add the full duration to that rounded start time
///
/// This guarantees the user gets at least their full duration,
/// and the expiry always lands on an hour boundary.
pub fn calculate_expiry_seconds(now_seconds: u64, duration_seconds: u64) -> Option<u64> {
    let effective_start_seconds = round_up_to_next_hour_seconds(now_seconds)?;
    effective_start_seconds.checked_add(duration_seconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOUR_ALIGNED_BASE_SECONDS: u64 = 277 * SECONDS_PER_HOUR;
    const ONE_HOUR_SECONDS: u64 = SECONDS_PER_HOUR;
    const SECONDS_45_MINS: u64 = 45 * 60;
    const SECONDS_1_HOUR: u64 = 3600;
    const SECONDS_24_HOURS: u64 = 24 * 3600;
    const SECONDS_7_DAYS: u64 = 7 * 24 * 3600;
    const TEST_TIMESTAMP_NS: u64 = 1_234_567_890_123;

    /// Given: a nanosecond timestamp
    /// When: converting it to seconds
    /// Then: sub-second precision is truncated
    #[test]
    fn test_nanos_to_seconds_truncates_sub_second_precision() {
        // given
        const EXPECTED_TIMESTAMP_SECONDS: u64 = 1_234;

        // when
        let timestamp_seconds = nanos_to_seconds(TEST_TIMESTAMP_NS);

        // then
        assert_eq!(timestamp_seconds, EXPECTED_TIMESTAMP_SECONDS);
    }

    /// Given: a seconds timestamp
    /// When: converting it to nanoseconds for an external API
    /// Then: the timestamp is scaled exactly when it fits
    #[test]
    fn test_seconds_to_nanos_for_external_api_scales_seconds() {
        // given
        const TIMESTAMP_SECONDS: u64 = 1_234;
        const EXPECTED_TIMESTAMP_NS: u64 = TIMESTAMP_SECONDS * NANOS_PER_SECOND;

        // when
        let timestamp_ns = seconds_to_nanos_for_external_api(TIMESTAMP_SECONDS);

        // then
        assert_eq!(timestamp_ns, Some(EXPECTED_TIMESTAMP_NS));
    }

    /// Given: a seconds timestamp too large to scale
    /// When: converting it to nanoseconds for an external API
    /// Then: conversion fails without overflowing
    #[test]
    fn test_seconds_to_nanos_for_external_api_rejects_overflow() {
        // given
        const OVERFLOWING_SECONDS: u64 = u64::MAX;

        // when
        let timestamp_ns = seconds_to_nanos_for_external_api(OVERFLOWING_SECONDS);

        // then
        assert_eq!(timestamp_ns, None);
    }

    /// Given: a timestamp in the middle of an hour
    /// When: rounding up to the next hour
    /// Then: the next hour boundary in seconds is returned
    #[test]
    fn test_round_up_mid_hour() {
        // given
        let offset_45m_30s = 45 * 60 + 30;
        let timestamp = HOUR_ALIGNED_BASE_SECONDS + offset_45m_30s;

        // when
        let rounded = round_up_to_next_hour_seconds(timestamp).unwrap();

        // then
        let expected = HOUR_ALIGNED_BASE_SECONDS + ONE_HOUR_SECONDS;
        assert_eq!(rounded, expected);
    }

    /// Given: a timestamp exactly on an hour boundary
    /// When: rounding up to the next hour
    /// Then: the following hour boundary is returned
    #[test]
    fn test_round_up_exactly_on_hour() {
        // given
        let timestamp = HOUR_ALIGNED_BASE_SECONDS;

        // when
        let rounded = round_up_to_next_hour_seconds(timestamp).unwrap();

        // then
        let expected = HOUR_ALIGNED_BASE_SECONDS + ONE_HOUR_SECONDS;
        assert_eq!(rounded, expected);
    }

    /// Given: a timestamp one second past an hour boundary
    /// When: rounding up to the next hour
    /// Then: the next hour boundary is returned
    #[test]
    fn test_round_up_one_second_past_hour() {
        // given
        let timestamp = HOUR_ALIGNED_BASE_SECONDS + 1;

        // when
        let rounded = round_up_to_next_hour_seconds(timestamp).unwrap();

        // then
        let expected = HOUR_ALIGNED_BASE_SECONDS + ONE_HOUR_SECONDS;
        assert_eq!(rounded, expected);
    }

    /// Given: a timestamp one second before an hour boundary
    /// When: rounding up to the next hour
    /// Then: the next hour boundary is returned
    #[test]
    fn test_round_up_one_second_before_hour() {
        // given
        let timestamp = HOUR_ALIGNED_BASE_SECONDS + ONE_HOUR_SECONDS - 1;

        // when
        let rounded = round_up_to_next_hour_seconds(timestamp).unwrap();

        // then
        let expected = HOUR_ALIGNED_BASE_SECONDS + ONE_HOUR_SECONDS;
        assert_eq!(rounded, expected);
    }

    /// Given: a one-hour option duration accepted mid-hour
    /// When: calculating expiry
    /// Then: expiry lands one full duration after the next hour boundary
    #[test]
    fn test_expiry_1_hour_duration() {
        // given
        let now = HOUR_ALIGNED_BASE_SECONDS + SECONDS_45_MINS;
        let duration_seconds = SECONDS_1_HOUR;

        // when
        let expiry = calculate_expiry_seconds(now, duration_seconds).unwrap();

        // then
        let expected = HOUR_ALIGNED_BASE_SECONDS + 2 * ONE_HOUR_SECONDS;
        assert_eq!(expiry, expected);
    }

    /// Given: a 24-hour option duration accepted mid-hour
    /// When: calculating expiry
    /// Then: expiry lands 24 hours after the next hour boundary
    #[test]
    fn test_expiry_24_hour_duration() {
        // given
        let now = HOUR_ALIGNED_BASE_SECONDS + SECONDS_45_MINS;
        let duration_seconds = SECONDS_24_HOURS;

        // when
        let expiry = calculate_expiry_seconds(now, duration_seconds).unwrap();

        // then
        let expected = HOUR_ALIGNED_BASE_SECONDS + 25 * ONE_HOUR_SECONDS;
        assert_eq!(expiry, expected);
    }

    /// Given: a seven-day option duration accepted mid-hour
    /// When: calculating expiry
    /// Then: expiry lands seven days after the next hour boundary
    #[test]
    fn test_expiry_7_day_duration() {
        // given
        let now = HOUR_ALIGNED_BASE_SECONDS + SECONDS_45_MINS;
        let duration_seconds = SECONDS_7_DAYS;

        // when
        let expiry = calculate_expiry_seconds(now, duration_seconds).unwrap();

        // then
        let hours_in_7_days = 7 * 24;
        let expected = HOUR_ALIGNED_BASE_SECONDS + (1 + hours_in_7_days) * ONE_HOUR_SECONDS;
        assert_eq!(expiry, expected);
    }

    /// Given: an option accepted exactly on an hour boundary
    /// When: calculating expiry
    /// Then: the user still gets the full duration from the next hour
    #[test]
    fn test_expiry_on_hour_gets_full_duration() {
        // given
        let now = HOUR_ALIGNED_BASE_SECONDS;
        let duration_seconds = SECONDS_1_HOUR;

        // when
        let expiry = calculate_expiry_seconds(now, duration_seconds).unwrap();

        // then
        let expected = HOUR_ALIGNED_BASE_SECONDS + 2 * ONE_HOUR_SECONDS;
        assert_eq!(expiry, expected);
    }

    /// Given: several acceptance times (on hour, mid-hour, one second past hour) and standard durations
    /// When: calculating expiry for each combination
    /// Then: every computed expiry is an exact UTC hour boundary (unix seconds divisible by 3600)
    #[test]
    fn test_calculate_expiry_seconds_always_on_hour_boundary() {
        // given
        const DURATION_1_HOUR: u64 = SECONDS_1_HOUR;
        const DURATION_24_HOURS: u64 = SECONDS_24_HOURS;
        const DURATION_7_DAYS: u64 = SECONDS_7_DAYS;

        let acceptance_times_seconds = [
            HOUR_ALIGNED_BASE_SECONDS,
            HOUR_ALIGNED_BASE_SECONDS + 1,
            HOUR_ALIGNED_BASE_SECONDS + SECONDS_45_MINS,
            HOUR_ALIGNED_BASE_SECONDS + ONE_HOUR_SECONDS - 1,
        ];

        // when / then
        for now_seconds in acceptance_times_seconds {
            for duration_seconds in [DURATION_1_HOUR, DURATION_24_HOURS, DURATION_7_DAYS] {
                let expiry_seconds =
                    calculate_expiry_seconds(now_seconds, duration_seconds).expect("expiry fits");
                assert_eq!(
                    expiry_seconds % SECONDS_PER_HOUR,
                    0,
                    "expiry_seconds={} from now_seconds={} duration_seconds={}",
                    expiry_seconds,
                    now_seconds,
                    duration_seconds
                );
            }
        }
    }
}

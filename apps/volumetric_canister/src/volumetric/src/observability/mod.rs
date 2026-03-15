mod storage;

use std::io;

use candid::CandidType;
use ic_http_types::{HttpRequest, HttpResponse, HttpResponseBuilder};
use ic_metrics_encoder::MetricsEncoder;
use serde::{Deserialize, Serialize};

use self::storage::collect_observability_storage_counts;

const OBSERVABILITY_METRICS_PATH: &str = "/observability/metrics";
const WASM_PAGE_SIZE_BYTES: u64 = 65_536;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct ObservabilityMetrics {
    pub profiles_total: u64,
    pub wallet_registrations_total: u64,
    pub signature_nonces_total: u64,
    pub whitelist_entries_total: u64,
    pub balances_total: u64,
    pub offers_total: u64,
    pub open_offers_total: u64,
    pub active_options_total: u64,
    pub events_total: u64,
    pub pending_withdrawals_total: u64,
    pub failed_withdrawals_total: u64,
    pub pending_accepts_total: u64,
    pub failed_accepts_total: u64,
    pub pending_settlements_total: u64,
    pub failed_settlements_total: u64,
    pub stable_memory_pages: u64,
    pub stable_memory_bytes: u64,
}

#[ic_cdk::query]
pub fn observability_get_metrics() -> ObservabilityMetrics {
    observability_collect_metrics()
}

#[ic_cdk::query]
pub fn http_request(request: HttpRequest) -> HttpResponse {
    match request.path() {
        OBSERVABILITY_METRICS_PATH => observability_serve_metrics_response(),
        _ => observability_plain_text_response(404, "not_found"),
    }
}

fn observability_collect_metrics() -> ObservabilityMetrics {
    let storage_counts = collect_observability_storage_counts();
    let stable_memory_pages = ic_cdk::stable::stable_size() as u64;

    ObservabilityMetrics {
        profiles_total: storage_counts.profiles_total,
        wallet_registrations_total: storage_counts.wallet_registrations_total,
        signature_nonces_total: storage_counts.signature_nonces_total,
        whitelist_entries_total: storage_counts.whitelist_entries_total,
        balances_total: storage_counts.balances_total,
        offers_total: storage_counts.offers_total,
        open_offers_total: storage_counts.open_offers_total,
        active_options_total: storage_counts.active_options_total,
        events_total: storage_counts.events_total,
        pending_withdrawals_total: storage_counts.pending_withdrawals_total,
        failed_withdrawals_total: storage_counts.failed_withdrawals_total,
        pending_accepts_total: storage_counts.pending_accepts_total,
        failed_accepts_total: storage_counts.failed_accepts_total,
        pending_settlements_total: storage_counts.pending_settlements_total,
        failed_settlements_total: storage_counts.failed_settlements_total,
        stable_memory_pages,
        stable_memory_bytes: stable_memory_pages.saturating_mul(WASM_PAGE_SIZE_BYTES),
    }
}

fn observability_encode_metrics(encoder: &mut MetricsEncoder<Vec<u8>>) -> io::Result<()> {
    let metrics = observability_collect_metrics();
    observability_encode_metrics_snapshot(&metrics, encoder)
}

fn observability_serve_metrics_response() -> HttpResponse {
    let mut encoder = MetricsEncoder::new(Vec::new(), observability_current_time_millis());

    match observability_encode_metrics(&mut encoder) {
        Ok(()) => HttpResponseBuilder::ok()
            .header("content-type", "text/plain; version=0.0.4; charset=utf-8")
            .body(encoder.into_inner())
            .build(),
        Err(error) => {
            observability_plain_text_response(500, &format!("failed to encode metrics: {error}"))
        }
    }
}

fn observability_encode_metrics_snapshot(
    metrics: &ObservabilityMetrics,
    encoder: &mut MetricsEncoder<Vec<u8>>,
) -> io::Result<()> {
    observability_encode_gauge(
        encoder,
        "volumetric_profiles_total",
        metrics.profiles_total,
        "Registered user profiles.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_wallet_registrations_total",
        metrics.wallet_registrations_total,
        "Wallet address to principal registrations.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_signature_nonces_total",
        metrics.signature_nonces_total,
        "Stored wallet signature nonces.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_whitelist_entries_total",
        metrics.whitelist_entries_total,
        "Whitelisted principals.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_balances_total",
        metrics.balances_total,
        "Stored user balance records.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_offers_total",
        metrics.offers_total,
        "Stored option offers.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_open_offers_total",
        metrics.open_offers_total,
        "Offers currently open for matching.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_active_options_total",
        metrics.active_options_total,
        "Stored active option records.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_events_total",
        metrics.events_total,
        "Stored event records.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_pending_withdrawals_total",
        metrics.pending_withdrawals_total,
        "Withdrawal journal entries that are still in progress.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_failed_withdrawals_total",
        metrics.failed_withdrawals_total,
        "Withdrawal journal entries in a failed state.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_pending_accepts_total",
        metrics.pending_accepts_total,
        "Accept journal entries that are still in progress.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_failed_accepts_total",
        metrics.failed_accepts_total,
        "Accept journal entries in a failed state.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_pending_settlements_total",
        metrics.pending_settlements_total,
        "Settlement journal entries that are still in progress.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_failed_settlements_total",
        metrics.failed_settlements_total,
        "Settlement journal entries in a failed state.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_stable_memory_pages",
        metrics.stable_memory_pages,
        "Stable memory size in WebAssembly pages.",
    )?;
    observability_encode_gauge(
        encoder,
        "volumetric_stable_memory_bytes",
        metrics.stable_memory_bytes,
        "Stable memory size in bytes.",
    )?;

    Ok(())
}

fn observability_encode_gauge(
    encoder: &mut MetricsEncoder<Vec<u8>>,
    name: &str,
    value: u64,
    help: &str,
) -> io::Result<()> {
    encoder.encode_gauge(name, value as f64, help)
}

fn observability_plain_text_response(status_code: u16, body: &str) -> HttpResponse {
    match status_code {
        404 => HttpResponseBuilder::not_found()
            .header("content-type", "text/plain; version=0.0.4; charset=utf-8")
            .body(body)
            .build(),
        500 => HttpResponseBuilder::server_error(body)
            .header("content-type", "text/plain; version=0.0.4; charset=utf-8")
            .build(),
        _ => HttpResponseBuilder::ok()
            .header("content-type", "text/plain; version=0.0.4; charset=utf-8")
            .body(body)
            .build(),
    }
}

fn observability_current_time_millis() -> i64 {
    let time_millis_u64 = ic_cdk::api::time() / 1_000_000;
    i64::try_from(time_millis_u64).unwrap_or(i64::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_metrics() -> ObservabilityMetrics {
        ObservabilityMetrics {
            profiles_total: 1,
            wallet_registrations_total: 2,
            signature_nonces_total: 3,
            whitelist_entries_total: 4,
            balances_total: 5,
            offers_total: 6,
            open_offers_total: 7,
            active_options_total: 8,
            events_total: 9,
            pending_withdrawals_total: 10,
            failed_withdrawals_total: 11,
            pending_accepts_total: 12,
            failed_accepts_total: 13,
            pending_settlements_total: 14,
            failed_settlements_total: 15,
            stable_memory_pages: 16,
            stable_memory_bytes: 17,
        }
    }

    #[test]
    fn test_http_request_path_ignores_query_string() {
        // given
        let request = HttpRequest {
            method: "GET".to_string(),
            url: "/observability/metrics?format=prometheus".to_string(),
            headers: vec![],
            body: Default::default(),
        };

        // when
        let path = request.path();

        // then
        assert_eq!(path, OBSERVABILITY_METRICS_PATH);
    }

    #[test]
    fn test_observability_encode_metrics_snapshot_includes_expected_metrics() {
        // given
        let metrics = sample_metrics();
        let mut encoder = MetricsEncoder::new(Vec::new(), 0);

        // when
        observability_encode_metrics_snapshot(&metrics, &mut encoder).unwrap();
        let output = String::from_utf8(encoder.into_inner()).unwrap();

        // then
        assert!(output.contains("volumetric_profiles_total"));
        assert!(output.contains("volumetric_active_options_total"));
        assert!(output.contains("volumetric_stable_memory_bytes"));
        assert!(output.contains("17"));
    }
}

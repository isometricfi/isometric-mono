use canlog::{
    export_logs, GetLogFilter, GlobalBuffer, LogEntry, LogFilter, LogPriorityLevels,
    PrintProxySink, Sink,
};
use ic_http_types::{HttpRequest, HttpResponse, HttpResponseBuilder};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[doc(hidden)]
pub use canlog as __canlog;

const LOGS_PATH: &str = "/logs";
const APPLICATION_JSON_CONTENT_TYPE: &str = "application/json; charset=utf-8";
const AUTHORIZATION_HEADER_NAME: &str = "authorization";
const BEARER_TOKEN_PREFIX: &str = "Bearer ";
const LOG_PRIORITY_CAPACITY: usize = 1_000;
const DEFAULT_LOG_LIMIT: usize = 1_000;
const MAX_LOG_LIMIT: usize = 5_000;
const MAX_LOG_OFFSET: usize = 5_000;
const NANOS_PER_SECOND: u64 = 1_000_000_000;

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum LogPriority {
    Debug,
    Info,
    Warn,
    Error,
}

canlog::declare_log_buffer!(name = DEBUG_BUF, capacity = LOG_PRIORITY_CAPACITY);
canlog::declare_log_buffer!(name = INFO_BUF, capacity = LOG_PRIORITY_CAPACITY);
canlog::declare_log_buffer!(name = WARN_BUF, capacity = LOG_PRIORITY_CAPACITY);
canlog::declare_log_buffer!(name = ERROR_BUF, capacity = LOG_PRIORITY_CAPACITY);

static DEBUG_PRIORITY: LogPriority = LogPriority::Debug;
static INFO_PRIORITY: LogPriority = LogPriority::Info;
static WARN_PRIORITY: LogPriority = LogPriority::Warn;
static ERROR_PRIORITY: LogPriority = LogPriority::Error;

const DEBUG_SINK: PrintProxySink<LogPriority> = PrintProxySink(&DEBUG_PRIORITY, &DEBUG_BUF);
const INFO_SINK: PrintProxySink<LogPriority> = PrintProxySink(&INFO_PRIORITY, &INFO_BUF);
const WARN_SINK: PrintProxySink<LogPriority> = PrintProxySink(&WARN_PRIORITY, &WARN_BUF);
const ERROR_SINK: PrintProxySink<LogPriority> = PrintProxySink(&ERROR_PRIORITY, &ERROR_BUF);

#[derive(Serialize)]
pub struct LogsResponse {
    logs: Vec<HttpLogEntry>,
    limit: usize,
    offset: usize,
}

#[derive(Serialize)]
pub struct HttpLogEntry {
    timestamp: u64,
    priority: &'static str,
    file: String,
    line: u32,
    message: String,
    counter: u64,
}

struct LogsQuery {
    include_debug: bool,
    min_timestamp_seconds: Option<u64>,
    limit: usize,
    offset: usize,
}

enum LogsQueryError {
    InvalidTime,
    InvalidLimit,
    InvalidOffset,
    ZeroLimit,
    OffsetTooLarge,
}

impl GetLogFilter for LogPriority {
    fn get_log_filter() -> LogFilter {
        LogFilter::ShowAll
    }
}

impl LogPriorityLevels for LogPriority {
    fn get_buffer(&self) -> &'static GlobalBuffer {
        match self {
            Self::Debug => &DEBUG_BUF,
            Self::Info => &INFO_BUF,
            Self::Warn => &WARN_BUF,
            Self::Error => &ERROR_BUF,
        }
    }

    fn get_sink(&self) -> &impl Sink {
        match self {
            Self::Debug => &DEBUG_SINK,
            Self::Info => &INFO_SINK,
            Self::Warn => &WARN_SINK,
            Self::Error => &ERROR_SINK,
        }
    }

    fn display_name(&self) -> &'static str {
        match self {
            Self::Debug => "DEBUG",
            Self::Info => "INFO",
            Self::Warn => "WARN",
            Self::Error => "ERROR",
        }
    }

    fn get_priorities() -> &'static [Self] {
        &[Self::Debug, Self::Info, Self::Warn, Self::Error]
    }
}

pub fn do_reply(request: HttpRequest) -> HttpResponse {
    if request.path() != LOGS_PATH {
        return HttpResponseBuilder::not_found()
            .header("content-type", "text/plain; charset=utf-8")
            .body("not_found")
            .build();
    }

    match parse_logs_query(&request) {
        Ok(query) => json_response(200, build_logs_response(query)),
        Err(error) => json_response(400, ErrorResponse::from(error)),
    }
}

pub fn do_reply_with_bearer_token_hash(
    request: HttpRequest,
    expected_token_sha256_hex: Option<&str>,
) -> HttpResponse {
    if request.path() != LOGS_PATH {
        return HttpResponseBuilder::not_found()
            .header("content-type", "text/plain; charset=utf-8")
            .body("not_found")
            .build();
    }

    if !is_authorized_with_bearer_token(&request, expected_token_sha256_hex) {
        return unauthorized_response();
    }

    match parse_logs_query(&request) {
        Ok(query) => json_response(200, build_logs_response(query)),
        Err(error) => json_response(400, ErrorResponse::from(error)),
    }
}

pub fn export_log_entries(include_debug: bool) -> Vec<LogEntry<LogPriority>> {
    let mut entries = Vec::new();

    if include_debug {
        entries.extend(export_log_entries_for_priority(LogPriority::Debug));
    }

    entries.extend(export_log_entries_for_priority(LogPriority::Info));
    entries.extend(export_log_entries_for_priority(LogPriority::Warn));
    entries.extend(export_log_entries_for_priority(LogPriority::Error));

    entries
}

pub fn bearer_token_sha256_hex(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    encode_hex(&digest)
}

#[macro_export]
macro_rules! log {
    ($($args:tt)*) => {{
        use $crate::__canlog::LogPriorityLevels;
        $crate::__canlog::raw_log!($crate::LogPriority::Info.get_sink(), $($args)*);
    }};
}

#[macro_export]
macro_rules! warn {
    ($($args:tt)*) => {{
        use $crate::__canlog::LogPriorityLevels;
        $crate::__canlog::raw_log!($crate::LogPriority::Warn.get_sink(), $($args)*);
    }};
}

#[macro_export]
macro_rules! error {
    ($($args:tt)*) => {{
        use $crate::__canlog::LogPriorityLevels;
        $crate::__canlog::raw_log!($crate::LogPriority::Error.get_sink(), $($args)*);
    }};
}

#[cfg(any(feature = "debug", all(test, not(target_arch = "wasm32"))))]
#[macro_export]
macro_rules! debug {
    ($($args:tt)*) => {{
        use $crate::__canlog::LogPriorityLevels;
        $crate::__canlog::raw_log!($crate::LogPriority::Debug.get_sink(), $($args)*);
    }};
}

#[cfg(not(any(feature = "debug", all(test, not(target_arch = "wasm32")))))]
#[macro_export]
macro_rules! debug {
    ($($args:tt)*) => {{
        let _ = format_args!($($args)*);
    }};
}

fn build_logs_response(query: LogsQuery) -> LogsResponse {
    let entries = export_log_entries(query.include_debug);
    build_logs_response_from_entries(query, entries)
}

fn build_logs_response_from_entries(
    query: LogsQuery,
    entries: Vec<LogEntry<LogPriority>>,
) -> LogsResponse {
    let mut logs = entries
        .into_iter()
        .filter(|entry| query.include_debug || entry.priority != LogPriority::Debug)
        .map(HttpLogEntry::from)
        .filter(|entry| {
            query
                .min_timestamp_seconds
                .map_or(true, |min_timestamp_seconds| {
                    entry.timestamp >= min_timestamp_seconds
                })
        })
        .collect::<Vec<_>>();

    logs.sort_by_key(|entry| (entry.timestamp, entry.counter));

    LogsResponse {
        logs: logs
            .into_iter()
            .skip(query.offset)
            .take(query.limit)
            .collect(),
        limit: query.limit,
        offset: query.offset,
    }
}

fn export_log_entries_for_priority(priority: LogPriority) -> Vec<LogEntry<LogPriority>> {
    export_logs(priority.get_buffer())
        .into_iter()
        .map(|entry| LogEntry {
            timestamp: entry.timestamp,
            priority,
            file: entry.file.to_string(),
            line: entry.line,
            message: entry.message,
            counter: entry.counter,
        })
        .collect()
}

fn parse_logs_query(request: &HttpRequest) -> Result<LogsQuery, LogsQueryError> {
    let include_debug = request.raw_query_param("debug") == Some("true");
    let min_timestamp_seconds = parse_optional_u64(request, "time", LogsQueryError::InvalidTime)?;
    let limit = parse_limit(request)?;
    let offset = parse_offset(request)?;

    Ok(LogsQuery {
        include_debug,
        min_timestamp_seconds,
        limit,
        offset,
    })
}

fn is_authorized_with_bearer_token(
    request: &HttpRequest,
    expected_token_sha256_hex: Option<&str>,
) -> bool {
    let Some(expected_token_sha256_hex) = expected_token_sha256_hex else {
        return false;
    };
    let Some(token) = bearer_token(request) else {
        return false;
    };

    let actual_token_sha256_hex = bearer_token_sha256_hex(token);
    constant_time_eq(
        actual_token_sha256_hex.as_bytes(),
        expected_token_sha256_hex.as_bytes(),
    )
}

fn bearer_token(request: &HttpRequest) -> Option<&str> {
    request
        .headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case(AUTHORIZATION_HEADER_NAME))
        .and_then(|(_, value)| value.strip_prefix(BEARER_TOKEN_PREFIX))
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }

    let diff = left
        .iter()
        .zip(right.iter())
        .fold(0u8, |diff, (left_byte, right_byte)| {
            diff | (left_byte ^ right_byte)
        });

    diff == 0
}

fn encode_hex(bytes: &[u8]) -> String {
    const HEX_CHARS: &[u8; 16] = b"0123456789abcdef";

    let mut hex = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        hex.push(HEX_CHARS[(byte >> 4) as usize] as char);
        hex.push(HEX_CHARS[(byte & 0x0f) as usize] as char);
    }
    hex
}

fn parse_limit(request: &HttpRequest) -> Result<usize, LogsQueryError> {
    let Some(raw_limit) = request.raw_query_param("limit") else {
        return Ok(DEFAULT_LOG_LIMIT);
    };

    let limit = raw_limit
        .parse::<usize>()
        .map_err(|_| LogsQueryError::InvalidLimit)?;
    if limit == 0 {
        return Err(LogsQueryError::ZeroLimit);
    }

    Ok(limit.min(MAX_LOG_LIMIT))
}

fn parse_offset(request: &HttpRequest) -> Result<usize, LogsQueryError> {
    let Some(raw_offset) = request.raw_query_param("offset") else {
        return Ok(0);
    };

    let offset = raw_offset
        .parse::<usize>()
        .map_err(|_| LogsQueryError::InvalidOffset)?;
    if offset > MAX_LOG_OFFSET {
        return Err(LogsQueryError::OffsetTooLarge);
    }

    Ok(offset)
}

fn parse_optional_u64(
    request: &HttpRequest,
    param_name: &str,
    error: LogsQueryError,
) -> Result<Option<u64>, LogsQueryError> {
    let Some(raw_value) = request.raw_query_param(param_name) else {
        return Ok(None);
    };

    raw_value.parse::<u64>().map(Some).map_err(|_| error)
}

fn json_response<T: Serialize>(status_code: u16, body: T) -> HttpResponse {
    let body_bytes = match serde_json::to_vec(&body) {
        Ok(body_bytes) => body_bytes,
        Err(_) => b"{\"error\":\"serialization_failed\"}".to_vec(),
    };

    match status_code {
        400 => HttpResponseBuilder::bad_request(),
        _ => HttpResponseBuilder::ok(),
    }
    .header("content-type", APPLICATION_JSON_CONTENT_TYPE)
    .body(body_bytes)
    .build()
}

fn unauthorized_response() -> HttpResponse {
    HttpResponse {
        status_code: 401,
        headers: vec![
            (
                "content-type".to_string(),
                APPLICATION_JSON_CONTENT_TYPE.to_string(),
            ),
            ("www-authenticate".to_string(), "Bearer".to_string()),
        ],
        body: serde_json::to_vec(&ErrorResponse {
            error: "unauthorized",
        })
        .unwrap_or_else(|_| b"{\"error\":\"unauthorized\"}".to_vec())
        .into(),
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    error: &'static str,
}

impl From<LogsQueryError> for ErrorResponse {
    fn from(error: LogsQueryError) -> Self {
        let error = match error {
            LogsQueryError::InvalidTime => "invalid_time",
            LogsQueryError::InvalidLimit => "invalid_limit",
            LogsQueryError::InvalidOffset => "invalid_offset",
            LogsQueryError::ZeroLimit => "limit_must_be_at_least_one",
            LogsQueryError::OffsetTooLarge => "offset_too_large",
        };

        Self { error }
    }
}

impl From<LogEntry<LogPriority>> for HttpLogEntry {
    fn from(entry: LogEntry<LogPriority>) -> Self {
        Self {
            timestamp: entry.timestamp / NANOS_PER_SECOND,
            priority: entry.priority.display_name(),
            file: entry.file,
            line: entry.line,
            message: entry.message,
            counter: entry.counter,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EARLY_TIMESTAMP_NS: u64 = 1_710_000_000_000_000_000;
    const LATE_TIMESTAMP_NS: u64 = 1_710_000_002_000_000_000;
    const EXPECTED_EARLY_TIMESTAMP_SECONDS: u64 = 1_710_000_000;
    const EXPECTED_LATE_TIMESTAMP_SECONDS: u64 = 1_710_000_002;

    /// Given: an HTTP request for a path other than /logs
    /// When: replying through the logging HTTP handler
    /// Then: returns a 404 response
    #[test]
    fn should_return_not_found_for_non_logs_path() {
        // given
        let request = request("/metrics");

        // when
        let response = do_reply(request);

        // then
        assert_eq!(response.status_code, 404);
    }

    /// Given: a /logs request with a non-numeric time query parameter
    /// When: replying through the logging HTTP handler
    /// Then: returns a typed bad request error
    #[test]
    fn should_return_bad_request_for_invalid_time() {
        // given
        let request = request("/logs?time=abc");

        // when
        let response = do_reply(request);

        // then
        assert_bad_request_error(response, "invalid_time");
    }

    /// Given: a /logs request with a non-numeric limit query parameter
    /// When: replying through the logging HTTP handler
    /// Then: returns a typed bad request error
    #[test]
    fn should_return_bad_request_for_invalid_limit() {
        // given
        let request = request("/logs?limit=abc");

        // when
        let response = do_reply(request);

        // then
        assert_bad_request_error(response, "invalid_limit");
    }

    /// Given: a /logs request with a non-numeric offset query parameter
    /// When: replying through the logging HTTP handler
    /// Then: returns a typed bad request error
    #[test]
    fn should_return_bad_request_for_invalid_offset() {
        // given
        let request = request("/logs?offset=abc");

        // when
        let response = do_reply(request);

        // then
        assert_bad_request_error(response, "invalid_offset");
    }

    /// Given: a /logs request without a bearer token
    /// When: replying through the token-gated logging HTTP handler
    /// Then: returns an unauthorized response
    #[test]
    fn should_reject_missing_bearer_token() {
        // given
        let request = request("/logs");
        let expected_token_hash = bearer_token_sha256_hex("a-secure-token-for-tests");

        // when
        let response = do_reply_with_bearer_token_hash(request, Some(&expected_token_hash));

        // then
        assert_unauthorized(response);
    }

    /// Given: a /logs request with the wrong bearer token
    /// When: replying through the token-gated logging HTTP handler
    /// Then: returns an unauthorized response
    #[test]
    fn should_reject_invalid_bearer_token() {
        // given
        let mut request = request("/logs");
        request.headers.push((
            "authorization".to_string(),
            "Bearer wrong-token".to_string(),
        ));
        let expected_token_hash = bearer_token_sha256_hex("a-secure-token-for-tests");

        // when
        let response = do_reply_with_bearer_token_hash(request, Some(&expected_token_hash));

        // then
        assert_unauthorized(response);
    }

    /// Given: a /logs request with the expected bearer token
    /// When: replying through the token-gated logging HTTP handler
    /// Then: returns the logs response
    #[test]
    fn should_allow_valid_bearer_token() {
        // given
        let token = "a-secure-token-for-tests";
        let mut request = request("/logs");
        request
            .headers
            .push(("authorization".to_string(), format!("Bearer {token}")));
        let expected_token_hash = bearer_token_sha256_hex(token);

        // when
        let response = do_reply_with_bearer_token_hash(request, Some(&expected_token_hash));

        // then
        assert_eq!(response.status_code, 200);
    }

    /// Given: a /logs request with limit set to zero
    /// When: replying through the logging HTTP handler
    /// Then: returns a typed bad request error
    #[test]
    fn should_return_bad_request_for_zero_limit() {
        // given
        let request = request("/logs?limit=0");

        // when
        let response = do_reply(request);

        // then
        assert_bad_request_error(response, "limit_must_be_at_least_one");
    }

    /// Given: a /logs request with a limit above the maximum
    /// When: replying through the logging HTTP handler
    /// Then: clamps the returned limit to the maximum
    #[test]
    fn should_clamp_large_limit() {
        // given
        let request = request("/logs?limit=999999");

        // when
        let response = do_reply(request);
        let body = response_body(response);

        // then
        assert_eq!(body["limit"], MAX_LOG_LIMIT);
    }

    /// Given: a /logs request with an offset above the maximum
    /// When: replying through the logging HTTP handler
    /// Then: returns a typed bad request error
    #[test]
    fn should_reject_large_offset() {
        // given
        let request = request("/logs?offset=5001");

        // when
        let response = do_reply(request);

        // then
        assert_bad_request_error(response, "offset_too_large");
    }

    /// Given: debug and info log entries
    /// When: building the response without debug logs enabled
    /// Then: excludes the debug entry
    #[test]
    fn should_exclude_debug_logs_by_default() {
        // given
        let query = LogsQuery {
            include_debug: false,
            min_timestamp_seconds: None,
            limit: DEFAULT_LOG_LIMIT,
            offset: 0,
        };
        let entries = vec![
            entry(LogPriority::Debug, EARLY_TIMESTAMP_NS, 1, "debug"),
            entry(LogPriority::Info, EARLY_TIMESTAMP_NS, 2, "info"),
        ];

        // when
        let response = build_logs_response_from_entries(query, entries);

        // then
        assert_eq!(response.logs.len(), 1);
        assert_eq!(response.logs[0].priority, "INFO");
    }

    /// Given: a debug log entry
    /// When: building the response with debug logs enabled
    /// Then: includes the debug entry
    #[test]
    fn should_include_debug_logs_when_requested() {
        // given
        let query = LogsQuery {
            include_debug: true,
            min_timestamp_seconds: None,
            limit: DEFAULT_LOG_LIMIT,
            offset: 0,
        };
        let entries = vec![entry(LogPriority::Debug, EARLY_TIMESTAMP_NS, 1, "debug")];

        // when
        let response = build_logs_response_from_entries(query, entries);

        // then
        assert_eq!(response.logs.len(), 1);
        assert_eq!(response.logs[0].priority, "DEBUG");
    }

    /// Given: log entries before and after a requested timestamp
    /// When: building the response with a time filter
    /// Then: only returns logs at or after that timestamp
    #[test]
    fn should_filter_logs_by_time() {
        // given
        let query = LogsQuery {
            include_debug: true,
            min_timestamp_seconds: Some(EXPECTED_LATE_TIMESTAMP_SECONDS),
            limit: DEFAULT_LOG_LIMIT,
            offset: 0,
        };
        let entries = vec![
            entry(LogPriority::Info, EARLY_TIMESTAMP_NS, 1, "early"),
            entry(LogPriority::Warn, LATE_TIMESTAMP_NS, 2, "late"),
        ];

        // when
        let response = build_logs_response_from_entries(query, entries);

        // then
        assert_eq!(response.logs.len(), 1);
        assert_eq!(response.logs[0].message, "late");
    }

    /// Given: unsorted log entries and pagination parameters
    /// When: building the response
    /// Then: sorts by timestamp and counter before paginating
    #[test]
    fn should_sort_logs_and_apply_pagination() {
        // given
        let query = LogsQuery {
            include_debug: true,
            min_timestamp_seconds: None,
            limit: 1,
            offset: 1,
        };
        let entries = vec![
            entry(LogPriority::Error, LATE_TIMESTAMP_NS, 3, "third"),
            entry(LogPriority::Info, EARLY_TIMESTAMP_NS, 1, "first"),
            entry(LogPriority::Warn, LATE_TIMESTAMP_NS, 2, "second"),
        ];

        // when
        let response = build_logs_response_from_entries(query, entries);

        // then
        assert_eq!(response.logs.len(), 1);
        assert_eq!(response.logs[0].message, "second");
    }

    /// Given: a log entry timestamped in nanoseconds
    /// When: building the response
    /// Then: returns the timestamp in seconds
    #[test]
    fn should_normalize_timestamps_to_seconds() {
        // given
        let query = LogsQuery {
            include_debug: true,
            min_timestamp_seconds: None,
            limit: DEFAULT_LOG_LIMIT,
            offset: 0,
        };
        let entries = vec![entry(LogPriority::Info, EARLY_TIMESTAMP_NS, 1, "info")];

        // when
        let response = build_logs_response_from_entries(query, entries);

        // then
        assert_eq!(response.logs[0].timestamp, EXPECTED_EARLY_TIMESTAMP_SECONDS);
    }

    fn request(url: &str) -> HttpRequest {
        HttpRequest {
            method: "GET".to_string(),
            url: url.to_string(),
            headers: vec![],
            body: Default::default(),
        }
    }

    fn entry(
        priority: LogPriority,
        timestamp: u64,
        counter: u64,
        message: &str,
    ) -> LogEntry<LogPriority> {
        LogEntry {
            timestamp,
            priority,
            file: "test.rs".to_string(),
            line: 42,
            message: message.to_string(),
            counter,
        }
    }

    fn response_body(response: HttpResponse) -> serde_json::Value {
        serde_json::from_slice(response.body.as_ref()).expect("response body should be JSON")
    }

    fn assert_bad_request_error(response: HttpResponse, expected_error: &str) {
        assert_eq!(response.status_code, 400);
        let body = response_body(response);
        assert_eq!(body["error"], expected_error);
    }

    fn assert_unauthorized(response: HttpResponse) {
        assert_eq!(response.status_code, 401);
        let body = response_body(response);
        assert_eq!(body["error"], "unauthorized");
    }
}

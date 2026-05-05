mod client;

pub use client::fetch_xrc_btc_usd_exchange_rate_snapshot_raw;
pub use client::get_btc_usd_price_cents;
pub use client::get_btc_usd_price_cents_at_time_seconds;
pub(crate) use client::xrc_timestamp_seconds_for_time_seconds;
pub use client::PriceOracle;
pub use client::StubOracle;

#[cfg(feature = "testing")]
pub(crate) use client::reset_oracle_internal;
#[cfg(feature = "testing")]
pub(crate) use client::set_oracle_price_internal;

#[cfg(test)]
pub use client::set_oracle;

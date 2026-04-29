CREATE TABLE IF NOT EXISTS btc_current_price (
  id TEXT PRIMARY KEY NOT NULL,
  price_usd_micros INTEGER NOT NULL,
  source TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  CHECK (id = 'bitcoin_usd'),
  CHECK (price_usd_micros > 0)
);

CREATE TABLE IF NOT EXISTS btc_history_points (
  timestamp_ms INTEGER PRIMARY KEY NOT NULL,
  price_usd_micros INTEGER NOT NULL,
  source TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  CHECK (timestamp_ms > 0),
  CHECK (price_usd_micros > 0)
);

CREATE TABLE IF NOT EXISTS xrc_btc_usd_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  fetched_at_ms INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  CHECK (fetched_at_ms > 0)
);

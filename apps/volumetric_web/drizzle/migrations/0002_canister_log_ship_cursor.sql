CREATE TABLE IF NOT EXISTS canister_log_ship_cursor (
  id TEXT PRIMARY KEY NOT NULL,
  last_shipped_timestamp_seconds INTEGER NOT NULL,
  last_shipped_counter INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  CHECK (id = 'cursor')
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  id_num INTEGER NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  principal TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_id_num_idx
  ON events (id_num ASC);

CREATE INDEX IF NOT EXISTS events_principal_id_num_idx
  ON events (principal ASC, id_num ASC);

CREATE INDEX IF NOT EXISTS events_principal_timestamp_idx
  ON events (principal ASC, timestamp ASC);

CREATE TABLE IF NOT EXISTS tracked_deposits (
  key TEXT PRIMARY KEY NOT NULL,
  user_address TEXT NOT NULL,
  deposit_address TEXT NOT NULL,
  txid TEXT NOT NULL,
  vout INTEGER NOT NULL CHECK (vout >= 0),
  value_sats INTEGER NOT NULL CHECK (value_sats >= 0),
  first_seen_at_ms INTEGER NOT NULL,
  first_seen_height INTEGER NOT NULL,
  confirmations INTEGER NOT NULL CHECK (confirmations >= 0),
  sync_attempt_count INTEGER NOT NULL CHECK (sync_attempt_count >= 0),
  next_sync_at_ms INTEGER NOT NULL,
  last_sync_at_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('matured', 'syncing', 'credited', 'expired')),
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tracked_deposits_status_next_sync_idx
  ON tracked_deposits (status ASC, next_sync_at_ms ASC);

CREATE INDEX IF NOT EXISTS tracked_deposits_user_status_first_seen_idx
  ON tracked_deposits (user_address ASC, status ASC, first_seen_at_ms ASC);

CREATE TABLE IF NOT EXISTS deposit_balance_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  user_address TEXT NOT NULL,
  before_available_sats TEXT NOT NULL,
  after_available_sats TEXT NOT NULL,
  delta_sats TEXT NOT NULL,
  synced_at_ms INTEGER NOT NULL,
  linked_tx_refs_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS deposit_balance_snapshots_user_synced_idx
  ON deposit_balance_snapshots (user_address ASC, synced_at_ms ASC);

CREATE TABLE IF NOT EXISTS user_deposit_addresses (
  user_address TEXT PRIMARY KEY NOT NULL,
  deposit_address TEXT NOT NULL UNIQUE,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS deposit_sync_state (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'cursor'),
  last_processed_block_height INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

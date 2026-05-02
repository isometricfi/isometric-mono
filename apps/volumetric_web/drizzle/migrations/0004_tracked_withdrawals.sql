CREATE TABLE IF NOT EXISTS tracked_withdrawals (
  operation_id TEXT PRIMARY KEY NOT NULL,
  user_address TEXT NOT NULL,
  withdrawal_id INTEGER NOT NULL,
  destination_address TEXT NOT NULL,
  amount_sats INTEGER NOT NULL CHECK (amount_sats >= 0),
  block_index INTEGER,
  bitcoin_txid TEXT,
  confirmations INTEGER NOT NULL CHECK (confirmations >= 0),
  phase TEXT NOT NULL,
  last_error TEXT,
  sync_attempt_count INTEGER NOT NULL CHECK (sync_attempt_count >= 0),
  next_sync_at_ms INTEGER NOT NULL,
  last_sync_at_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('broadcasting', 'pending', 'completed', 'failed', 'expired')),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tracked_withdrawals_status_next_sync_idx
  ON tracked_withdrawals (status ASC, next_sync_at_ms ASC);

CREATE INDEX IF NOT EXISTS tracked_withdrawals_user_status_created_idx
  ON tracked_withdrawals (user_address ASC, status ASC, created_at_ms ASC);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_at_ms INTEGER NOT NULL
);

INSERT INTO feature_flags (key, enabled, updated_at_ms)
VALUES ('pause_mode', 0, CAST(strftime('%s','now') AS INTEGER) * 1000);

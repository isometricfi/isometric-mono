CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS waitlist_signups (
  email TEXT PRIMARY KEY NOT NULL,
  created_at_ms INTEGER NOT NULL,
  locale TEXT,
  referrer TEXT
);

CREATE INDEX IF NOT EXISTS waitlist_signups_created_idx
  ON waitlist_signups (created_at_ms ASC);

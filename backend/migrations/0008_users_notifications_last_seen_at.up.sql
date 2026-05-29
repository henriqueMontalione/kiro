-- Per-user timestamp of the last time the merchant opened the notifications
-- panel. Notifications themselves are derived from transactions on the client,
-- so we only persist the "read up to" marker.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_last_seen_at TIMESTAMPTZ;

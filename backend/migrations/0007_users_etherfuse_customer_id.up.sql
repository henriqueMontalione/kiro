-- No-op safe migration: the column may or may not exist depending on whether
-- the previous attempt of this migration ran against this database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS etherfuse_customer_id TEXT;

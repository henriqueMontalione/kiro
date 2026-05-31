DROP INDEX IF EXISTS idx_users_etherfuse_customer_id;
ALTER TABLE users DROP COLUMN IF EXISTS etherfuse_bank_account_id;

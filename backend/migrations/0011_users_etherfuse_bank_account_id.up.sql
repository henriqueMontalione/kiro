-- Persists the Etherfuse customer/bank-account identifiers per user so the
-- ramp webhook can attribute incoming events without touching kyc_profiles
-- (which only the abandoned programmatic wizard populated). The customer_id
-- column already exists from migration 0007; here we add the bank account
-- counterpart and index the customer_id lookup used by the webhook.
ALTER TABLE users ADD COLUMN IF NOT EXISTS etherfuse_bank_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_etherfuse_customer_id
    ON users(etherfuse_customer_id)
    WHERE etherfuse_customer_id IS NOT NULL;

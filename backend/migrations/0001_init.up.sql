-- Initial schema. Auth is delegated to Privy: every user row is keyed by the
-- Privy DID (sub claim of the JWT), so we never store passwords or sessions.

CREATE TABLE users (
    id                 UUID PRIMARY KEY,
    privy_user_id      TEXT UNIQUE NOT NULL,
    store_name         VARCHAR(255) NOT NULL,
    cnpj               VARCHAR(14) UNIQUE NOT NULL,
    email              VARCHAR(255) NOT NULL,
    pix_key            VARCHAR(255) NOT NULL,
    stellar_public_key VARCHAR(56) NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_privy ON users(privy_user_id);

CREATE TABLE sales (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    external_id  VARCHAR(255) NOT NULL,
    gross_amount BIGINT NOT NULL,
    net_amount   BIGINT NOT NULL,
    due_date     TIMESTAMPTZ NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE anticipations (
    id                UUID PRIMARY KEY,
    sale_id           UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_to_advance BIGINT NOT NULL,
    kiro_fee          BIGINT NOT NULL,
    amount_disbursed  BIGINT NOT NULL,
    stellar_tx_hash   VARCHAR(64),
    status            VARCHAR(20) NOT NULL DEFAULT 'requested',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE withdrawals (
    id                    UUID PRIMARY KEY,
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount                BIGINT NOT NULL,
    pix_destination       VARCHAR(255) NOT NULL,
    stellar_burn_tx_hash  VARCHAR(64),
    external_transfer_id  VARCHAR(255),
    status                VARCHAR(20) NOT NULL DEFAULT 'processing',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_logs (
    id            UUID PRIMARY KEY,
    provider      VARCHAR(50) NOT NULL,
    payload       JSONB NOT NULL,
    processed     BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

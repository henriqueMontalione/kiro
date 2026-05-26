CREATE TABLE transactions (
    id                  UUID PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    direction           VARCHAR(10) NOT NULL,
    tesouro_amount      BIGINT NOT NULL,
    brl_amount          BIGINT NOT NULL,
    stellar_tx_hash     VARCHAR(64),
    etherfuse_order_id  VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT transactions_direction_check CHECK (direction IN ('in', 'out')),
    CONSTRAINT transactions_amounts_positive CHECK (tesouro_amount >= 0 AND brl_amount >= 0)
);

CREATE INDEX idx_transactions_user_created ON transactions(user_id, created_at DESC);

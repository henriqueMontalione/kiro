CREATE TABLE users (
    id UUID PRIMARY KEY,
    store_name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pix_key VARCHAR(255) NOT NULL,
    stellar_public_key VARCHAR(56) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE TABLE sales (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    external_id VARCHAR(255) NOT NULL,
    gross_amount BIGINT NOT NULL,
    net_amount BIGINT NOT NULL,
    due_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE anticipations (
    id UUID PRIMARY KEY,
    sale_id UUID REFERENCES sales(id),
    user_id UUID REFERENCES users(id),
    amount_to_advance BIGINT NOT NULL,
    kiro_fee BIGINT NOT NULL,
    amount_disbursed BIGINT NOT NULL,
    stellar_tx_hash VARCHAR(64),
    status VARCHAR(20) DEFAULT 'requested',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE withdrawals (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    amount BIGINT NOT NULL,
    pix_destination VARCHAR(255) NOT NULL,
    stellar_burn_tx_hash VARCHAR(64),
    external_transfer_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
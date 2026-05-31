-- kyc_profiles: personal identity data for Etherfuse KYC, all PII encrypted at rest.
-- Also extends the consent_logs policy_type check to allow Etherfuse data-sharing consent.

ALTER TABLE consent_logs DROP CONSTRAINT consent_logs_policy_type_check;
ALTER TABLE consent_logs ADD CONSTRAINT consent_logs_policy_type_check CHECK (
    policy_type IN ('terms_of_use', 'privacy_policy', 'data_sharing_etherfuse')
);

CREATE TABLE kyc_profiles (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    given_name_enc          BYTEA       NOT NULL,
    family_name_enc         BYTEA       NOT NULL,
    cpf_enc                 BYTEA       NOT NULL,
    cpf_hash                BYTEA       NOT NULL UNIQUE,
    birth_date_enc          BYTEA       NOT NULL,
    address_street_enc      BYTEA       NOT NULL,
    address_city_enc        BYTEA       NOT NULL,
    address_state_enc       BYTEA       NOT NULL,
    address_postal_code_enc BYTEA       NOT NULL,
    ef_customer_id          TEXT,
    docs_uploaded           BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

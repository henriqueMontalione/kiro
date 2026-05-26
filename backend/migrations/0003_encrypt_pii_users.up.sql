-- DESTRUCTIVE in dev: drops existing rows because we can't re-encrypt plaintext
-- after the column type changes. Safe here since the pre-encryption rows are
-- test data. For a future production migration, do this differently:
--   1) ADD nullable encrypted columns alongside the plaintext ones
--   2) Run a Go migration script: read plaintext, encrypt, write to new cols
--   3) Run a second migration that DROPs the plaintext columns and sets NOT NULL

DELETE FROM consent_logs;
DELETE FROM users;

ALTER TABLE users
    DROP COLUMN store_name,
    DROP COLUMN cnpj,
    DROP COLUMN email,
    DROP COLUMN pix_key;

ALTER TABLE users
    ADD COLUMN store_name_enc BYTEA NOT NULL,
    ADD COLUMN cnpj_enc       BYTEA NOT NULL,
    ADD COLUMN cnpj_hash      BYTEA NOT NULL UNIQUE,
    ADD COLUMN email_enc      BYTEA NOT NULL,
    ADD COLUMN pix_key_enc    BYTEA NOT NULL;

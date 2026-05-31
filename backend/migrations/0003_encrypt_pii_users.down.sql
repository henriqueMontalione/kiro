DELETE FROM consent_logs;
DELETE FROM users;

ALTER TABLE users
    DROP COLUMN store_name_enc,
    DROP COLUMN cnpj_enc,
    DROP COLUMN cnpj_hash,
    DROP COLUMN email_enc,
    DROP COLUMN pix_key_enc;

ALTER TABLE users
    ADD COLUMN store_name VARCHAR(255) NOT NULL,
    ADD COLUMN cnpj       VARCHAR(14) UNIQUE NOT NULL,
    ADD COLUMN email      VARCHAR(255) NOT NULL,
    ADD COLUMN pix_key    VARCHAR(255) NOT NULL;

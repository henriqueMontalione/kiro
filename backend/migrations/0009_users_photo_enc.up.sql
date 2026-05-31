-- Profile photo (avatar or store logo). Treated as biometric-level PII per
-- LGPD: encrypted at rest with the same AES-256-GCM vault used for CPF/email.
-- Stored as the full data URL ("data:image/jpeg;base64,...") so we don't need
-- a separate column to track MIME type. Nullable because the merchant can
-- leave it blank.
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_enc BYTEA;

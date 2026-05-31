DROP TABLE IF EXISTS kyc_profiles;

ALTER TABLE consent_logs DROP CONSTRAINT consent_logs_policy_type_check;
ALTER TABLE consent_logs ADD CONSTRAINT consent_logs_policy_type_check CHECK (
    policy_type IN ('terms_of_use', 'privacy_policy')
);

-- name: CreateKycProfile :one
INSERT INTO kyc_profiles (
    id, user_id,
    given_name_enc, family_name_enc,
    cpf_enc, cpf_hash,
    birth_date_enc,
    address_street_enc, address_city_enc, address_state_enc, address_postal_code_enc,
    ef_customer_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
RETURNING id, user_id, given_name_enc, family_name_enc, cpf_enc, cpf_hash, birth_date_enc, address_street_enc, address_city_enc, address_state_enc, address_postal_code_enc, ef_customer_id, docs_uploaded, created_at, updated_at;

-- name: GetKycProfileByUserID :one
SELECT id, user_id, given_name_enc, family_name_enc, cpf_enc, cpf_hash, birth_date_enc, address_street_enc, address_city_enc, address_state_enc, address_postal_code_enc, ef_customer_id, docs_uploaded, created_at, updated_at
FROM kyc_profiles
WHERE user_id = $1;

-- name: MarkKycDocsUploaded :one
UPDATE kyc_profiles
SET docs_uploaded = TRUE, updated_at = NOW()
WHERE user_id = $1
RETURNING id, user_id, given_name_enc, family_name_enc, cpf_enc, cpf_hash, birth_date_enc, address_street_enc, address_city_enc, address_state_enc, address_postal_code_enc, ef_customer_id, docs_uploaded, created_at, updated_at;

-- name: GetEtherfuseConsent :one
SELECT id, policy_type, policy_version, action, created_at
FROM consent_logs
WHERE user_id = $1 AND policy_type = 'data_sharing_etherfuse'
ORDER BY created_at DESC
LIMIT 1;

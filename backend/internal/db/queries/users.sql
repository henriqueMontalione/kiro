-- name: GetUserByPrivyID :one
SELECT id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, photo_enc, status, created_at, updated_at
FROM users
WHERE privy_user_id = $1 AND status = 'active';

-- name: GetUserByEfCustomerID :one
-- Looks up the Kiro user that owns a given Etherfuse customer id. Used by the
-- ramp webhook to attribute incoming order events to a merchant.
SELECT u.id, u.privy_user_id, u.store_name_enc, u.cnpj_enc, u.cnpj_hash, u.email_enc, u.pix_key_enc, u.stellar_public_key, u.photo_enc, u.status, u.created_at, u.updated_at
FROM users u
JOIN kyc_profiles kp ON kp.user_id = u.id
WHERE kp.ef_customer_id = $1 AND u.status = 'active';

-- name: CreateUser :one
INSERT INTO users (
    id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, photo_enc, status, created_at, updated_at;

-- name: UpdateUser :one
UPDATE users
SET
    store_name_enc = COALESCE(sqlc.narg('store_name_enc'), store_name_enc),
    pix_key_enc    = COALESCE(sqlc.narg('pix_key_enc'), pix_key_enc),
    updated_at     = NOW()
WHERE privy_user_id = $1 AND status = 'active'
RETURNING id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, photo_enc, status, created_at, updated_at;

-- name: UpdateUserPhoto :one
UPDATE users
SET photo_enc = $2, updated_at = NOW()
WHERE privy_user_id = $1 AND status = 'active'
RETURNING id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, photo_enc, status, created_at, updated_at;

-- name: SoftDeleteUser :exec
UPDATE users
SET status = 'inactive', updated_at = NOW()
WHERE privy_user_id = $1 AND status = 'active';

-- name: GetNotificationsLastSeen :one
SELECT notifications_last_seen_at
FROM users
WHERE id = $1;

-- name: UpdateNotificationsLastSeen :exec
UPDATE users
SET notifications_last_seen_at = $2, updated_at = NOW()
WHERE id = $1;

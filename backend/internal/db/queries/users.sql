-- name: GetUserByPrivyID :one
SELECT id, privy_user_id, store_name, cnpj, email, pix_key, stellar_public_key, status, created_at, updated_at
FROM users
WHERE privy_user_id = $1 AND status = 'active';

-- name: CreateUser :one
INSERT INTO users (
    id, privy_user_id, store_name, cnpj, email, pix_key, stellar_public_key
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING id, privy_user_id, store_name, cnpj, email, pix_key, stellar_public_key, status, created_at, updated_at;

-- name: UpdateUser :one
-- COALESCE leaves the existing value untouched when the caller passes NULL.
-- CNPJ, email and stellar_public_key are intentionally NOT updatable here —
-- changes to those should go through dedicated flows with proper re-verification.
UPDATE users
SET
    store_name = COALESCE(sqlc.narg('store_name'), store_name),
    pix_key    = COALESCE(sqlc.narg('pix_key'), pix_key),
    updated_at = NOW()
WHERE privy_user_id = $1 AND status = 'active'
RETURNING id, privy_user_id, store_name, cnpj, email, pix_key, stellar_public_key, status, created_at, updated_at;

-- name: SoftDeleteUser :exec
UPDATE users
SET status = 'inactive', updated_at = NOW()
WHERE privy_user_id = $1 AND status = 'active';

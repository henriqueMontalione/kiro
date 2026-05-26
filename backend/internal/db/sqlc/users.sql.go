package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const getUserByPrivyID = `-- name: GetUserByPrivyID :one
SELECT id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, status, created_at, updated_at
FROM users
WHERE privy_user_id = $1 AND status = 'active'
`

func (q *Queries) GetUserByPrivyID(ctx context.Context, privyUserID string) (User, error) {
	row := q.db.QueryRow(ctx, getUserByPrivyID, privyUserID)
	var u User
	err := row.Scan(
		&u.ID,
		&u.PrivyUserID,
		&u.StoreNameEnc,
		&u.CnpjEnc,
		&u.CnpjHash,
		&u.EmailEnc,
		&u.PixKeyEnc,
		&u.StellarPublicKey,
		&u.Status,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	return u, err
}

const createUser = `-- name: CreateUser :one
INSERT INTO users (
    id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, status, created_at, updated_at
`

type CreateUserParams struct {
	ID               uuid.UUID `json:"id"`
	PrivyUserID      string    `json:"privy_user_id"`
	StoreNameEnc     []byte    `json:"store_name_enc"`
	CnpjEnc          []byte    `json:"cnpj_enc"`
	CnpjHash         []byte    `json:"cnpj_hash"`
	EmailEnc         []byte    `json:"email_enc"`
	PixKeyEnc        []byte    `json:"pix_key_enc"`
	StellarPublicKey string    `json:"stellar_public_key"`
}

func (q *Queries) CreateUser(ctx context.Context, arg CreateUserParams) (User, error) {
	row := q.db.QueryRow(ctx, createUser,
		arg.ID,
		arg.PrivyUserID,
		arg.StoreNameEnc,
		arg.CnpjEnc,
		arg.CnpjHash,
		arg.EmailEnc,
		arg.PixKeyEnc,
		arg.StellarPublicKey,
	)
	var u User
	err := row.Scan(
		&u.ID,
		&u.PrivyUserID,
		&u.StoreNameEnc,
		&u.CnpjEnc,
		&u.CnpjHash,
		&u.EmailEnc,
		&u.PixKeyEnc,
		&u.StellarPublicKey,
		&u.Status,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	return u, err
}

const updateUser = `-- name: UpdateUser :one
UPDATE users
SET
    store_name_enc = COALESCE($2, store_name_enc),
    pix_key_enc    = COALESCE($3, pix_key_enc),
    updated_at     = NOW()
WHERE privy_user_id = $1 AND status = 'active'
RETURNING id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, status, created_at, updated_at
`

type UpdateUserParams struct {
	PrivyUserID  string `json:"privy_user_id"`
	StoreNameEnc []byte `json:"store_name_enc"`
	PixKeyEnc    []byte `json:"pix_key_enc"`
}

func (q *Queries) UpdateUser(ctx context.Context, arg UpdateUserParams) (User, error) {
	row := q.db.QueryRow(ctx, updateUser, arg.PrivyUserID, arg.StoreNameEnc, arg.PixKeyEnc)
	var u User
	err := row.Scan(
		&u.ID,
		&u.PrivyUserID,
		&u.StoreNameEnc,
		&u.CnpjEnc,
		&u.CnpjHash,
		&u.EmailEnc,
		&u.PixKeyEnc,
		&u.StellarPublicKey,
		&u.Status,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	return u, err
}

const softDeleteUser = `-- name: SoftDeleteUser :exec
UPDATE users
SET status = 'inactive', updated_at = NOW()
WHERE privy_user_id = $1 AND status = 'active'
`

func (q *Queries) SoftDeleteUser(ctx context.Context, privyUserID string) error {
	_, err := q.db.Exec(ctx, softDeleteUser, privyUserID)
	return err
}

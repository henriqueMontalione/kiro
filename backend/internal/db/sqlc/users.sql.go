package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const getUserByPrivyID = `-- name: GetUserByPrivyID :one
SELECT id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, photo_enc, etherfuse_customer_id, etherfuse_bank_account_id, status, created_at, updated_at
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
		&u.PhotoEnc,
		&u.EtherfuseCustomerID,
		&u.EtherfuseBankAccountID,
		&u.Status,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	return u, err
}

const getUserByEfCustomerID = `-- name: GetUserByEfCustomerID :one
SELECT id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, photo_enc, etherfuse_customer_id, etherfuse_bank_account_id, status, created_at, updated_at
FROM users
WHERE etherfuse_customer_id = $1 AND status = 'active'
`

func (q *Queries) GetUserByEfCustomerID(ctx context.Context, efCustomerID string) (User, error) {
	row := q.db.QueryRow(ctx, getUserByEfCustomerID, efCustomerID)
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
		&u.PhotoEnc,
		&u.EtherfuseCustomerID,
		&u.EtherfuseBankAccountID,
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
RETURNING id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, photo_enc, etherfuse_customer_id, etherfuse_bank_account_id, status, created_at, updated_at
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
		&u.PhotoEnc,
		&u.EtherfuseCustomerID,
		&u.EtherfuseBankAccountID,
		&u.Status,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	return u, err
}

const updateUser = `-- name: UpdateUser :one
UPDATE users
SET
    store_name_enc            = COALESCE($2, store_name_enc),
    pix_key_enc               = COALESCE($3, pix_key_enc),
    etherfuse_customer_id     = COALESCE($4, etherfuse_customer_id),
    etherfuse_bank_account_id = COALESCE($5, etherfuse_bank_account_id),
    updated_at                = NOW()
WHERE privy_user_id = $1 AND status = 'active'
RETURNING id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, photo_enc, etherfuse_customer_id, etherfuse_bank_account_id, status, created_at, updated_at
`

type UpdateUserParams struct {
	PrivyUserID            string  `json:"privy_user_id"`
	StoreNameEnc           []byte  `json:"store_name_enc"`
	PixKeyEnc              []byte  `json:"pix_key_enc"`
	EtherfuseCustomerID    *string `json:"etherfuse_customer_id"`
	EtherfuseBankAccountID *string `json:"etherfuse_bank_account_id"`
}

func (q *Queries) UpdateUser(ctx context.Context, arg UpdateUserParams) (User, error) {
	row := q.db.QueryRow(ctx, updateUser,
		arg.PrivyUserID,
		arg.StoreNameEnc,
		arg.PixKeyEnc,
		arg.EtherfuseCustomerID,
		arg.EtherfuseBankAccountID,
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
		&u.PhotoEnc,
		&u.EtherfuseCustomerID,
		&u.EtherfuseBankAccountID,
		&u.Status,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	return u, err
}

const updateUserPhoto = `-- name: UpdateUserPhoto :one
UPDATE users
SET photo_enc = $2, updated_at = NOW()
WHERE privy_user_id = $1 AND status = 'active'
RETURNING id, privy_user_id, store_name_enc, cnpj_enc, cnpj_hash, email_enc, pix_key_enc, stellar_public_key, photo_enc, etherfuse_customer_id, etherfuse_bank_account_id, status, created_at, updated_at
`

type UpdateUserPhotoParams struct {
	PrivyUserID string `json:"privy_user_id"`
	PhotoEnc    []byte `json:"photo_enc"`
}

func (q *Queries) UpdateUserPhoto(ctx context.Context, arg UpdateUserPhotoParams) (User, error) {
	row := q.db.QueryRow(ctx, updateUserPhoto, arg.PrivyUserID, arg.PhotoEnc)
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
		&u.PhotoEnc,
		&u.EtherfuseCustomerID,
		&u.EtherfuseBankAccountID,
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

const getNotificationsLastSeen = `-- name: GetNotificationsLastSeen :one
SELECT notifications_last_seen_at
FROM users
WHERE id = $1
`

func (q *Queries) GetNotificationsLastSeen(ctx context.Context, id uuid.UUID) (pgtype.Timestamptz, error) {
	var ts pgtype.Timestamptz
	err := q.db.QueryRow(ctx, getNotificationsLastSeen, id).Scan(&ts)
	return ts, err
}

const updateNotificationsLastSeen = `-- name: UpdateNotificationsLastSeen :exec
UPDATE users
SET notifications_last_seen_at = $2, updated_at = NOW()
WHERE id = $1
`

func (q *Queries) UpdateNotificationsLastSeen(ctx context.Context, id uuid.UUID, ts time.Time) error {
	_, err := q.db.Exec(ctx, updateNotificationsLastSeen, id, ts)
	return err
}

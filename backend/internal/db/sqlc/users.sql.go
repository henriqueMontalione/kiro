package sqlc

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const getUserByPrivyID = `-- name: GetUserByPrivyID :one
SELECT id, privy_user_id, store_name, cnpj, email, pix_key, stellar_public_key, status, created_at, updated_at
FROM users
WHERE privy_user_id = $1 AND status = 'active'
`

func (q *Queries) GetUserByPrivyID(ctx context.Context, privyUserID string) (User, error) {
	row := q.db.QueryRow(ctx, getUserByPrivyID, privyUserID)
	var u User
	err := row.Scan(
		&u.ID,
		&u.PrivyUserID,
		&u.StoreName,
		&u.Cnpj,
		&u.Email,
		&u.PixKey,
		&u.StellarPublicKey,
		&u.Status,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	return u, err
}

const createUser = `-- name: CreateUser :one
INSERT INTO users (
    id, privy_user_id, store_name, cnpj, email, pix_key, stellar_public_key
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING id, privy_user_id, store_name, cnpj, email, pix_key, stellar_public_key, status, created_at, updated_at
`

type CreateUserParams struct {
	ID               uuid.UUID `json:"id"`
	PrivyUserID      string    `json:"privy_user_id"`
	StoreName        string    `json:"store_name"`
	Cnpj             string    `json:"cnpj"`
	Email            string    `json:"email"`
	PixKey           string    `json:"pix_key"`
	StellarPublicKey string    `json:"stellar_public_key"`
}

func (q *Queries) CreateUser(ctx context.Context, arg CreateUserParams) (User, error) {
	row := q.db.QueryRow(ctx, createUser,
		arg.ID,
		arg.PrivyUserID,
		arg.StoreName,
		arg.Cnpj,
		arg.Email,
		arg.PixKey,
		arg.StellarPublicKey,
	)
	var u User
	err := row.Scan(
		&u.ID,
		&u.PrivyUserID,
		&u.StoreName,
		&u.Cnpj,
		&u.Email,
		&u.PixKey,
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
    store_name = COALESCE($2, store_name),
    pix_key    = COALESCE($3, pix_key),
    updated_at = NOW()
WHERE privy_user_id = $1 AND status = 'active'
RETURNING id, privy_user_id, store_name, cnpj, email, pix_key, stellar_public_key, status, created_at, updated_at
`

type UpdateUserParams struct {
	PrivyUserID string      `json:"privy_user_id"`
	StoreName   pgtype.Text `json:"store_name"`
	PixKey      pgtype.Text `json:"pix_key"`
}

func (q *Queries) UpdateUser(ctx context.Context, arg UpdateUserParams) (User, error) {
	row := q.db.QueryRow(ctx, updateUser, arg.PrivyUserID, arg.StoreName, arg.PixKey)
	var u User
	err := row.Scan(
		&u.ID,
		&u.PrivyUserID,
		&u.StoreName,
		&u.Cnpj,
		&u.Email,
		&u.PixKey,
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

package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Transaction struct {
	ID               uuid.UUID   `json:"id"`
	UserID           uuid.UUID   `json:"user_id"`
	Direction        string      `json:"direction"`
	TesouroAmount    int64       `json:"tesouro_amount"`
	BrlAmount        int64       `json:"brl_amount"`
	FeeBrlAmount     int64       `json:"fee_brl_amount"`
	StellarTxHash    pgtype.Text `json:"stellar_tx_hash"`
	EtherfuseOrderID pgtype.Text `json:"etherfuse_order_id"`
	Status           string      `json:"status"`
	CreatedAt        time.Time   `json:"created_at"`
}

const insertTransaction = `-- name: InsertTransaction :one
INSERT INTO transactions (
    id, user_id, direction, tesouro_amount, brl_amount, fee_brl_amount, stellar_tx_hash, etherfuse_order_id, status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING id, user_id, direction, tesouro_amount, brl_amount, fee_brl_amount, stellar_tx_hash, etherfuse_order_id, status, created_at
`

type InsertTransactionParams struct {
	ID               uuid.UUID   `json:"id"`
	UserID           uuid.UUID   `json:"user_id"`
	Direction        string      `json:"direction"`
	TesouroAmount    int64       `json:"tesouro_amount"`
	BrlAmount        int64       `json:"brl_amount"`
	FeeBrlAmount     int64       `json:"fee_brl_amount"`
	StellarTxHash    pgtype.Text `json:"stellar_tx_hash"`
	EtherfuseOrderID pgtype.Text `json:"etherfuse_order_id"`
	Status           string      `json:"status"`
}

func (q *Queries) InsertTransaction(ctx context.Context, arg InsertTransactionParams) (Transaction, error) {
	row := q.db.QueryRow(ctx, insertTransaction,
		arg.ID, arg.UserID, arg.Direction, arg.TesouroAmount, arg.BrlAmount, arg.FeeBrlAmount,
		arg.StellarTxHash, arg.EtherfuseOrderID, arg.Status,
	)
	var t Transaction
	err := row.Scan(
		&t.ID, &t.UserID, &t.Direction, &t.TesouroAmount, &t.BrlAmount, &t.FeeBrlAmount,
		&t.StellarTxHash, &t.EtherfuseOrderID, &t.Status, &t.CreatedAt,
	)
	return t, err
}

const listTransactionsByUserID = `-- name: ListTransactionsByUserID :many
SELECT id, user_id, direction, tesouro_amount, brl_amount, fee_brl_amount, stellar_tx_hash, etherfuse_order_id, status, created_at
FROM transactions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2
`

type ListTransactionsByUserIDParams struct {
	UserID uuid.UUID `json:"user_id"`
	Limit  int32     `json:"limit"`
}

func (q *Queries) ListTransactionsByUserID(ctx context.Context, arg ListTransactionsByUserIDParams) ([]Transaction, error) {
	rows, err := q.db.Query(ctx, listTransactionsByUserID, arg.UserID, arg.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []Transaction{}
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.Direction, &t.TesouroAmount, &t.BrlAmount, &t.FeeBrlAmount,
			&t.StellarTxHash, &t.EtherfuseOrderID, &t.Status, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

const sumFeesByUserID = `-- name: SumFeesByUserID :one
SELECT COALESCE(SUM(fee_brl_amount), 0)::BIGINT AS total_fee_brl
FROM transactions
WHERE user_id = $1 AND status = 'completed'
`

func (q *Queries) SumFeesByUserID(ctx context.Context, userID uuid.UUID) (int64, error) {
	var total int64
	err := q.db.QueryRow(ctx, sumFeesByUserID, userID).Scan(&total)
	return total, err
}

const listAllTransactionsByUserID = `-- name: ListAllTransactionsByUserID :many
SELECT id, user_id, direction, tesouro_amount, brl_amount, fee_brl_amount, stellar_tx_hash, etherfuse_order_id, status, created_at
FROM transactions
WHERE user_id = $1
ORDER BY created_at DESC
`

func (q *Queries) ListAllTransactionsByUserID(ctx context.Context, userID uuid.UUID) ([]Transaction, error) {
	rows, err := q.db.Query(ctx, listAllTransactionsByUserID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []Transaction{}
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.Direction, &t.TesouroAmount, &t.BrlAmount, &t.FeeBrlAmount,
			&t.StellarTxHash, &t.EtherfuseOrderID, &t.Status, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

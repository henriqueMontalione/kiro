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
	StellarTxHash    pgtype.Text `json:"stellar_tx_hash"`
	EtherfuseOrderID pgtype.Text `json:"etherfuse_order_id"`
	Status           string      `json:"status"`
	CreatedAt        time.Time   `json:"created_at"`
}

const insertTransaction = `-- name: InsertTransaction :one
INSERT INTO transactions (
    id, user_id, direction, tesouro_amount, brl_amount, stellar_tx_hash, etherfuse_order_id, status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING id, user_id, direction, tesouro_amount, brl_amount, stellar_tx_hash, etherfuse_order_id, status, created_at
`

type InsertTransactionParams struct {
	ID               uuid.UUID   `json:"id"`
	UserID           uuid.UUID   `json:"user_id"`
	Direction        string      `json:"direction"`
	TesouroAmount    int64       `json:"tesouro_amount"`
	BrlAmount        int64       `json:"brl_amount"`
	StellarTxHash    pgtype.Text `json:"stellar_tx_hash"`
	EtherfuseOrderID pgtype.Text `json:"etherfuse_order_id"`
	Status           string      `json:"status"`
}

func (q *Queries) InsertTransaction(ctx context.Context, arg InsertTransactionParams) (Transaction, error) {
	row := q.db.QueryRow(ctx, insertTransaction,
		arg.ID, arg.UserID, arg.Direction, arg.TesouroAmount, arg.BrlAmount,
		arg.StellarTxHash, arg.EtherfuseOrderID, arg.Status,
	)
	var t Transaction
	err := row.Scan(
		&t.ID, &t.UserID, &t.Direction, &t.TesouroAmount, &t.BrlAmount,
		&t.StellarTxHash, &t.EtherfuseOrderID, &t.Status, &t.CreatedAt,
	)
	return t, err
}

const listTransactionsByUserID = `-- name: ListTransactionsByUserID :many
SELECT id, user_id, direction, tesouro_amount, brl_amount, stellar_tx_hash, etherfuse_order_id, status, created_at
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
			&t.ID, &t.UserID, &t.Direction, &t.TesouroAmount, &t.BrlAmount,
			&t.StellarTxHash, &t.EtherfuseOrderID, &t.Status, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

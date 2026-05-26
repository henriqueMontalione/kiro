-- name: InsertTransaction :one
INSERT INTO transactions (
    id, user_id, direction, tesouro_amount, brl_amount, stellar_tx_hash, etherfuse_order_id, status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING id, user_id, direction, tesouro_amount, brl_amount, stellar_tx_hash, etherfuse_order_id, status, created_at;

-- name: ListTransactionsByUserID :many
SELECT id, user_id, direction, tesouro_amount, brl_amount, stellar_tx_hash, etherfuse_order_id, status, created_at
FROM transactions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2;

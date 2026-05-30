-- name: UpsertTransactionByEtherfuseOrderID :one
-- Idempotent insert keyed on etherfuse_order_id so repeated webhook events for
-- the same order collapse into a single row. created_at is preserved from the
-- first event; downstream-mutable fields (amounts, status, stellar tx hash)
-- get overwritten with the latest payload.
INSERT INTO transactions (
    id, user_id, direction, tesouro_amount, brl_amount, fee_brl_amount,
    stellar_tx_hash, etherfuse_order_id, status
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
ON CONFLICT (etherfuse_order_id) WHERE etherfuse_order_id IS NOT NULL
DO UPDATE SET
    tesouro_amount  = EXCLUDED.tesouro_amount,
    brl_amount      = EXCLUDED.brl_amount,
    fee_brl_amount  = EXCLUDED.fee_brl_amount,
    stellar_tx_hash = EXCLUDED.stellar_tx_hash,
    status          = EXCLUDED.status
RETURNING id, user_id, direction, tesouro_amount, brl_amount, fee_brl_amount, stellar_tx_hash, etherfuse_order_id, status, created_at;

-- name: ListTransactionsByUserID :many
SELECT id, user_id, direction, tesouro_amount, brl_amount, fee_brl_amount, stellar_tx_hash, etherfuse_order_id, status, created_at
FROM transactions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: SumFeesByUserID :one
SELECT COALESCE(SUM(fee_brl_amount), 0)::BIGINT AS total_fee_brl
FROM transactions
WHERE user_id = $1 AND status = 'completed';

-- name: ListAllTransactionsByUserID :many
SELECT id, user_id, direction, tesouro_amount, brl_amount, fee_brl_amount, stellar_tx_hash, etherfuse_order_id, status, created_at
FROM transactions
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetInvestmentAggregates :one
SELECT
    COALESCE(SUM(CASE WHEN direction = 'in'  THEN brl_amount + fee_brl_amount ELSE 0 END), 0)::BIGINT AS total_paid_brl,
    COALESCE(SUM(CASE WHEN direction = 'out' THEN brl_amount ELSE 0 END), 0)::BIGINT AS total_received_brl
FROM transactions
WHERE user_id = $1 AND status = 'completed';

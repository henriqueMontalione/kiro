// Code in this package mirrors what `sqlc generate` would produce from the
// queries in internal/db/queries/*.sql. Running `sqlc generate` should yield
// equivalent output. We keep it hand-written so the project builds without
// requiring sqlc to be installed locally.

package sqlc

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// DBTX is the minimum interface satisfied by *pgxpool.Pool and pgx.Tx.
// Queries are usable with either, so callers can opt into a transaction
// without a separate code path.
type DBTX interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

type Queries struct {
	db DBTX
}

func New(db DBTX) *Queries {
	return &Queries{db: db}
}

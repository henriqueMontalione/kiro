package sqlc

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type ConsentLog struct {
	ID            uuid.UUID   `json:"id"`
	UserID        uuid.UUID   `json:"user_id"`
	PolicyType    string      `json:"policy_type"`
	PolicyVersion string      `json:"policy_version"`
	Action        string      `json:"action"`
	IPAddress     pgtype.Text `json:"ip_address"`
	UserAgent     pgtype.Text `json:"user_agent"`
	CreatedAt     time.Time   `json:"created_at"`
}

const insertConsentLog = `-- name: InsertConsentLog :one
INSERT INTO consent_logs (
    id, user_id, policy_type, policy_version, action, ip_address, user_agent
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING id, user_id, policy_type, policy_version, action, ip_address, user_agent, created_at
`

type InsertConsentLogParams struct {
	ID            uuid.UUID   `json:"id"`
	UserID        uuid.UUID   `json:"user_id"`
	PolicyType    string      `json:"policy_type"`
	PolicyVersion string      `json:"policy_version"`
	Action        string      `json:"action"`
	IPAddress     pgtype.Text `json:"ip_address"`
	UserAgent     pgtype.Text `json:"user_agent"`
}

func (q *Queries) InsertConsentLog(ctx context.Context, arg InsertConsentLogParams) (ConsentLog, error) {
	row := q.db.QueryRow(ctx, insertConsentLog,
		arg.ID, arg.UserID, arg.PolicyType, arg.PolicyVersion,
		arg.Action, arg.IPAddress, arg.UserAgent,
	)
	var c ConsentLog
	err := row.Scan(
		&c.ID, &c.UserID, &c.PolicyType, &c.PolicyVersion,
		&c.Action, &c.IPAddress, &c.UserAgent, &c.CreatedAt,
	)
	return c, err
}

const listConsentLogsByUserID = `-- name: ListConsentLogsByUserID :many
SELECT id, user_id, policy_type, policy_version, action, ip_address, user_agent, created_at
FROM consent_logs
WHERE user_id = $1
ORDER BY created_at DESC
`

func (q *Queries) ListConsentLogsByUserID(ctx context.Context, userID uuid.UUID) ([]ConsentLog, error) {
	rows, err := q.db.Query(ctx, listConsentLogsByUserID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []ConsentLog{}
	for rows.Next() {
		var c ConsentLog
		if err := rows.Scan(
			&c.ID, &c.UserID, &c.PolicyType, &c.PolicyVersion,
			&c.Action, &c.IPAddress, &c.UserAgent, &c.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

const listLatestActiveConsents = `-- name: ListLatestActiveConsents :many
SELECT DISTINCT ON (policy_type)
    id, user_id, policy_type, policy_version, action, ip_address, user_agent, created_at
FROM consent_logs
WHERE user_id = $1
ORDER BY policy_type, created_at DESC
`

func (q *Queries) ListLatestActiveConsents(ctx context.Context, userID uuid.UUID) ([]ConsentLog, error) {
	rows, err := q.db.Query(ctx, listLatestActiveConsents, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []ConsentLog{}
	for rows.Next() {
		var c ConsentLog
		if err := rows.Scan(
			&c.ID, &c.UserID, &c.PolicyType, &c.PolicyVersion,
			&c.Action, &c.IPAddress, &c.UserAgent, &c.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

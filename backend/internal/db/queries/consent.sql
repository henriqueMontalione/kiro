-- name: InsertConsentLog :one
INSERT INTO consent_logs (
    id, user_id, policy_type, policy_version, action, ip_address, user_agent
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING id, user_id, policy_type, policy_version, action, ip_address, user_agent, created_at;

-- name: ListConsentLogsByUserID :many
SELECT id, user_id, policy_type, policy_version, action, ip_address, user_agent, created_at
FROM consent_logs
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: ListLatestActiveConsents :many
-- Returns the most recent consent event per (user_id, policy_type) where the
-- last action was 'granted'. Used by deleteMe to know which consents are
-- currently active and need a matching revocation event.
SELECT DISTINCT ON (policy_type)
    id, user_id, policy_type, policy_version, action, ip_address, user_agent, created_at
FROM consent_logs
WHERE user_id = $1
ORDER BY policy_type, created_at DESC;

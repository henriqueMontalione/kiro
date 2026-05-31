-- Append-only audit log of every consent action (granted / revoked) for each
-- policy version. This is the LGPD-compliant proof that the lojista accepted
-- (or later revoked) a specific version of the Política de Privacidade /
-- Termos de Uso. Never UPDATE rows here — always INSERT a new event.
--
-- "Is user X currently consented to policy Y at the latest version?" is
-- answered by reading the most recent row for (user_id, policy_type) and
-- checking action='granted' + policy_version=current.

CREATE TABLE consent_logs (
    id             UUID PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    policy_type    VARCHAR(50) NOT NULL,
    policy_version VARCHAR(20) NOT NULL,
    action         VARCHAR(20) NOT NULL,
    ip_address     VARCHAR(45),
    user_agent     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT consent_logs_action_check CHECK (action IN ('granted', 'revoked')),
    CONSTRAINT consent_logs_policy_type_check CHECK (
        policy_type IN ('terms_of_use', 'privacy_policy')
    )
);

CREATE INDEX idx_consent_logs_user_policy
    ON consent_logs(user_id, policy_type, created_at DESC);

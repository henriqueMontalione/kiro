/**
 * Single source of truth for the policy versions a lojista accepts on
 * cadastro. Bump these when the corresponding text changes — the backend
 * stores the version per acceptance, so an old user remains tied to v1.0
 * while new users sign v1.1.
 *
 * The actual policy text lives outside the repo (see BACKLOG-JURIDICO.md).
 */

export const POLICY_VERSIONS = {
  terms_of_use: 'v1.0',
  privacy_policy: 'v1.0',
  data_sharing_etherfuse: 'v1.0',
} as const;

export type PolicyType = keyof typeof POLICY_VERSIONS;

/** Pretty labels for surfacing in the UI. */
export const POLICY_LABELS: Record<PolicyType, string> = {
  terms_of_use: 'Termos de Uso',
  privacy_policy: 'Política de Privacidade',
  data_sharing_etherfuse: 'Compartilhamento de dados com parceiro',
};

/** Policy types accepted by `POST /api/me` (core onboarding). Partner-specific
 *  consents like `data_sharing_etherfuse` are sent via their own endpoints. */
const ME_CONSENTS: PolicyType[] = ['terms_of_use', 'privacy_policy'];

/** Builds the consents array required by `POST /api/me`. */
export function currentRequiredConsents(): Array<{
  policy_type: PolicyType;
  policy_version: string;
}> {
  return ME_CONSENTS.map((t) => ({
    policy_type: t,
    policy_version: POLICY_VERSIONS[t],
  }));
}

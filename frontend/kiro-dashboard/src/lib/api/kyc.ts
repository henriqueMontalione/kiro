const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000';

async function req<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 204 || res.status === 201) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  const data = JSON.parse(text);
  if (res.status >= 400) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export interface KycProfileStatus {
  has_profile: boolean;
  docs_uploaded: boolean;
  consent_given: boolean;
  ef_customer_id?: string;
  created_at?: string;
}

export async function getKycProfile(token: string): Promise<KycProfileStatus> {
  return req<KycProfileStatus>('/api/me/kyc-profile', token);
}

export interface CreateKycProfileBody {
  given_name: string;
  family_name: string;
  cpf: string;
  birth_date: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_postal_code: string;
  ef_customer_id: string;
}

export async function createKycProfile(token: string, body: CreateKycProfileBody): Promise<void> {
  return req<void>('/api/me/kyc-profile', token, { method: 'POST', body: JSON.stringify(body) });
}

export async function markKycDocsUploaded(token: string): Promise<void> {
  return req<void>('/api/me/kyc-profile/docs', token, { method: 'POST' });
}

export async function postEtherfuseConsent(token: string): Promise<void> {
  return req<void>('/api/me/consent', token, {
    method: 'POST',
    body: JSON.stringify({ policy_type: 'data_sharing_etherfuse', policy_version: 'v1.0' }),
  });
}

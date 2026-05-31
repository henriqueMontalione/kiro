/**
 * Client for the Kiro Go backend's /api/me endpoints
 */

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000';

export interface UserProfile {
  id: string;
  store_name: string;
  cnpj: string;
  email: string;
  pix_key: string;
  stellar_public_key: string;
  /** Full data URL (e.g. "data:image/jpeg;base64,…") or null when the merchant
   *  hasn't uploaded a profile photo / store logo yet. Decrypted server-side
   *  on every GET /api/me. */
  photo_data_url: string | null;
  /** Etherfuse identifiers persisted server-side so the ramp webhook can
   *  attribute order events to this merchant. Populated on first onboarding. */
  etherfuse_customer_id: string | null;
  etherfuse_bank_account_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ConsentAcceptance {
  policy_type: string;
  policy_version: string;
}

export interface CreateMeBody {
  store_name: string;
  cnpj: string;
  email: string;
  pix_key: string;
  stellar_public_key: string;
  consents: ConsentAcceptance[];
}

export interface UpdateMeBody {
  store_name?: string;
  pix_key?: string;
  etherfuse_customer_id?: string;
  etherfuse_bank_account_id?: string;
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<{ status: number; data: T | { error?: string } | null }> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  // 204 No Content (e.g. DELETE) has no body to parse.
  if (res.status === 204) return { status: 204, data: null };

  const text = await res.text();
  if (!text) return { status: res.status, data: null };
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    throw new Error(`Resposta inválida do backend (HTTP ${res.status})`);
  }
}

/**
 * Returns the profile for the authenticated lojista, or `null` when the
 * backend reports 404 (i.e. the user hasn't completed onboarding yet).
 */
export async function getMe(token: string): Promise<UserProfile | null> {
  const { status, data } = await request<UserProfile>('/api/me', token);
  if (status === 404) return null;
  if (status >= 400) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${status}`;
    throw new Error(msg);
  }
  return data as UserProfile;
}

export async function createMe(token: string, body: CreateMeBody): Promise<UserProfile> {
  const { status, data } = await request<UserProfile>('/api/me', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (status >= 400) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${status}`;
    throw new Error(msg);
  }
  return data as UserProfile;
}

export async function updateMe(token: string, body: UpdateMeBody): Promise<UserProfile> {
  const { status, data } = await request<UserProfile>('/api/me', token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (status >= 400) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${status}`;
    throw new Error(msg);
  }
  return data as UserProfile;
}

/**
 * Uploads or removes the user's profile photo. Pass a data URL to set; pass
 * `null` to clear. Returns the refreshed profile so the caller can update
 * its local state in one round trip.
 */
export async function updateMyPhoto(
  token: string,
  photoDataUrl: string | null,
): Promise<UserProfile> {
  const { status, data } = await request<UserProfile>('/api/me/photo', token, {
    method: 'PUT',
    body: JSON.stringify({ photo_data_url: photoDataUrl }),
  });
  if (status >= 400) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${status}`;
    throw new Error(msg);
  }
  return data as UserProfile;
}

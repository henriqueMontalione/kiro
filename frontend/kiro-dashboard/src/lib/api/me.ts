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
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMeBody {
  store_name: string;
  cnpj: string;
  email: string;
  pix_key: string;
  stellar_public_key: string;
}

export interface UpdateMeBody {
  store_name?: string;
  pix_key?: string;
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

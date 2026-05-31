const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000';

async function req(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

export async function getNotificationsLastSeen(token: string): Promise<string | null> {
  const res = await req('/api/me/notifications/last-seen', token);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { last_seen_at: string | null };
  return data.last_seen_at;
}

export async function markNotificationsRead(token: string, lastSeenAt: string): Promise<void> {
  const res = await req('/api/me/notifications/last-seen', token, {
    method: 'POST',
    body: JSON.stringify({ last_seen_at: lastSeenAt }),
  });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}

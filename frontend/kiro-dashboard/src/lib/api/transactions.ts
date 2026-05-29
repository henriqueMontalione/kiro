const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000';

export type Direction = 'in' | 'out';

export interface Transaction {
  id: string;
  direction: Direction;
  /** TESOURO in stroops (amount × 10^7). */
  tesouro_amount: number;
  /** BRL in centavos (amount × 100). */
  brl_amount: number;
  /** Fee charged by the exchange, in centavos. */
  fee_brl_amount: number;
  stellar_tx_hash?: string;
  etherfuse_order_id?: string;
  status: string;
  created_at: string;
}

export interface CreateTransactionBody {
  direction: Direction;
  tesouro_amount: number;
  brl_amount: number;
  fee_brl_amount?: number;
  stellar_tx_hash?: string;
  etherfuse_order_id?: string;
  status?: string;
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
  if (res.status === 204) return { status: 204, data: null };
  const text = await res.text();
  if (!text) return { status: res.status, data: null };
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    throw new Error(`Resposta inválida do backend (HTTP ${res.status})`);
  }
}

export async function listTransactions(token: string): Promise<Transaction[]> {
  const { status, data } = await request<Transaction[]>('/api/me/transactions', token);
  if (status >= 400) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${status}`;
    throw new Error(msg);
  }
  return (data as Transaction[]) ?? [];
}

/**
 * Triggers a browser download of the user's full transaction history as CSV.
 * Streams from the backend; nothing is held in memory client-side.
 */
export async function downloadTransactionsCSV(token: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/me/transactions/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try { msg = (JSON.parse(text) as { error?: string }).error ?? msg; } catch { /* keep */ }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `kiro-transacoes-${new Date().toISOString().slice(0, 10)}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function getTotalFees(token: string): Promise<number> {
  const { status, data } = await request<{ total_fee_brl_amount: number }>(
    '/api/me/transactions/fees/total',
    token,
  );
  if (status >= 400) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${status}`;
    throw new Error(msg);
  }
  return (data as { total_fee_brl_amount: number } | null)?.total_fee_brl_amount ?? 0;
}

export async function createTransaction(token: string, body: CreateTransactionBody): Promise<Transaction> {
  const { status, data } = await request<Transaction>('/api/me/transactions', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (status >= 400) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${status}`;
    throw new Error(msg);
  }
  return data as Transaction;
}

/** Converts stroops (BIGINT in DB) to decimal TESOURO string with 7 places. */
export function stroopsToTesouro(stroops: number): string {
  const sign = stroops < 0 ? '-' : '';
  const abs = Math.abs(stroops);
  const whole = Math.floor(abs / 10_000_000);
  const frac = (abs % 10_000_000).toString().padStart(7, '0');
  return `${sign}${whole}.${frac}`;
}

/** Inverse of stroopsToTesouro. */
export function tesouroToStroops(tesouro: string): number {
  const [w, f = ''] = tesouro.split('.');
  const frac = (f + '0000000').slice(0, 7);
  return Number(BigInt(w) * 10_000_000n + BigInt(frac));
}

/** Centavos (BIGINT in DB) → formatted BRL string. */
export function centavosToBRL(centavos: number): string {
  const value = centavos / 100;
  return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

import type { KycStatus, SavedFiatAccount } from '../types';

const BASE = '/api';

async function apiFetch<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  if (!text) throw new Error(`Resposta vazia de ${path}`);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Server returned HTML (e.g. Vite's index.html fallback) — proxy/middleware misconfigured.
    throw new Error(`Rota ${path} não encontrada. Reinicie o servidor de dev (npm run dev).`);
  }
  if (!res.ok) {
    throw new Error((data.error as string | undefined) ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export interface OnboardingResult {
  /** Canonical customer ID — may differ from the input if the wallet was already onboarded. */
  customerId: string;
  /** Canonical bank account ID — may be an existing one if the customer already had accounts. */
  bankAccountId: string;
  /** Hosted KYC/onboarding URL. */
  kycUrl: string;
}

/**
 * Starts (or recovers) onboarding for a wallet. The server transparently handles
 * the "wallet already added to another customer" case by switching to the
 * existing customer ID + bank account. Always treat the returned IDs as authoritative.
 */
export async function startOnboarding(
  customerId: string,
  bankAccountId: string,
  publicKey: string,
): Promise<OnboardingResult> {
  return apiFetch<OnboardingResult>('POST', '/ef-onboarding', {
    customerId,
    bankAccountId,
    publicKey,
  });
}

/** Returns the canonical KYC status for a customer+wallet pair. */
export async function getKycStatus(
  customerId: string,
  publicKey: string,
): Promise<KycStatus> {
  const { status } = await apiFetch<{ status: string }>('GET', '/ef-kyc-status', undefined, {
    customerId,
    publicKey,
  });
  if (status === 'approved' || status === 'approved_chain_deploying') return 'approved';
  if (status === 'proposed') return 'pending';
  if (status === 'rejected') return 'rejected';
  return 'not_started';
}

/** Lists registered PIX/fiat accounts for a customer. */
export async function getBankAccounts(customerId: string): Promise<SavedFiatAccount[]> {
  const { accounts } = await apiFetch<{
    accounts: Array<{
      bankAccountId: string;
      pixKey?: string;
      accountHolderName?: string;
      createdAt: string;
    }>;
  }>('POST', '/ef-bank-accounts', { customerId });

  return accounts.map((a) => ({
    id: a.bankAccountId,
    type: 'pix',
    accountNumber: a.pixKey ?? '',
    bankName: 'PIX',
    accountHolderName: a.accountHolderName ?? '',
    createdAt: a.createdAt,
  }));
}

export interface QuoteResult {
  quoteId: string;
  sourceAmount: string;
  destinationAmount: string;
  exchangeRate: string;
  fee: string;
  expiresAt: string;
}

/** Gets a TESOURO→BRL off-ramp quote for the given source amount. */
export async function getQuote(
  customerId: string,
  sourceAmount: string,
): Promise<QuoteResult> {
  return apiFetch<QuoteResult>('POST', '/ef-quote', { customerId, sourceAmount });
}

/** Creates an off-ramp order. Returns the Etherfuse order ID. */
export async function createOrder(
  quoteId: string,
  stellarAddress: string,
  bankAccountId: string,
): Promise<{ orderId: string }> {
  return apiFetch<{ orderId: string }>('POST', '/ef-order', {
    quoteId,
    stellarAddress,
    bankAccountId,
  });
}

export interface OrderPollResult {
  orderId: string;
  status: string;
  burnTransaction: string | null;
}

/** Polls a single order status. Check `burnTransaction` — present when XDR is ready. */
export async function getOrder(orderId: string): Promise<OrderPollResult> {
  return apiFetch<OrderPollResult>('GET', '/ef-order', undefined, { orderId });
}

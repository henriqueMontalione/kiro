import { Horizon, Networks } from '@stellar/stellar-sdk';

const networkKey = (import.meta.env.VITE_STELLAR_NETWORK ?? 'TESTNET') as keyof typeof Networks;


export const NETWORK_PASSPHRASE: string = Networks[networkKey];

export const TESOURO_CODE: string = import.meta.env.VITE_TESOURO_CODE ?? 'TESOURO';
export const TESOURO_ISSUER: string = import.meta.env.VITE_TESOURO_ISSUER ?? '';

const horizonUrl =
  import.meta.env.VITE_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

const horizonServer = new Horizon.Server(horizonUrl);


export async function fetchTesouroBalance(publicKey: string): Promise<string | null> {
  if (!TESOURO_ISSUER) return null;
  try {
    const account = await horizonServer.loadAccount(publicKey);
    const line = account.balances.find(
      (b) =>
        (b.asset_type === 'credit_alphanum4' || b.asset_type === 'credit_alphanum12') &&
        'asset_code' in b &&
        b.asset_code === TESOURO_CODE &&
        'asset_issuer' in b &&
        b.asset_issuer === TESOURO_ISSUER,
    );
    return line ? line.balance : '0.0000000';
  } catch {
    return null;
  }
}

export function formatBRL(rawBalance: string): string {
  const num = parseFloat(rawBalance);
  if (isNaN(num)) return 'R$ 0,00';
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** G1AB…XZ9K */
export function truncateKey(key: string): string {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export async function submitXdr(signedXdr: string, authToken: string): Promise<string> {
  const res = await fetch('/api/stellar-submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ signedXdr }),
  });
  // Read as text first so empty/HTML bodies (e.g. SPA fallback if the dev
  // proxy isn't loaded) surface as a clear error instead of a JSON parse crash.
  const raw = await res.text();
  let data: { hash?: string; error?: string } = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`Resposta inválida do servidor (HTTP ${res.status}). Reinicie o dev server.`);
    }
  }
  if (!res.ok || !data.hash) throw new Error(data.error ?? `Falha ao submeter transação (HTTP ${res.status})`);
  return data.hash;
}

export interface WalletPayment {
  /** Horizon operation ID. */
  id: string;
  /** Stellar transaction hash. */
  hash: string;
  /** `out` = TESOURO leaving the wallet (saque via PIX). `in` = TESOURO arriving (pagamento). */
  direction: 'in' | 'out';
  /** Raw decimal string (e.g. "100.0000000"). */
  amount: string;
  /** Pre-formatted BRL value, e.g. "R$ 100,00". */
  amountBRL: string;
  /** Raw BRL in centavos — used for aggregations and charts. */
  brlCentavos: number;
  /** Fee charged on this transaction, in centavos. */
  feeCentavos: number;
  /** Pre-formatted fee, e.g. "R$ 0,50". */
  feeBRL: string;
  /** Localized relative timestamp: "Hoje, 14:32" / "Ontem, 18:45" / "12 jan, 14:32". */
  when: string;
  /** ISO 8601 creation timestamp from Horizon. */
  createdAt: string;
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return `Hoje, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Ontem, ${time}`;

  const dateStr = date
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '');
  return `${dateStr}, ${time}`;
}

/**
 * Returns the most recent TESOURO movements touching this wallet (sent or received).
 *
 * Uses Horizon's `effects` endpoint (not `payments`) so that contract-driven
 * transfers — Etherfuse on-ramp/off-ramp orders go through the TESOURO SAC, not
 * a classic Stellar payment — are captured alongside regular payments.
 *
 * Empty array if the issuer isn't configured or Horizon is unreachable.
 */
export async function fetchTesouroPayments(
  publicKey: string,
  limit = 10,
): Promise<WalletPayment[]> {
  if (!TESOURO_ISSUER) return [];
  try {
    // Overfetch because effects include many non-TESOURO types (trustlines,
    // signers, etc.). Capped at Horizon's per-request max of 200.
    const horizonLimit = Math.min(limit * 4, 200);
    const page = await horizonServer
      .effects()
      .forAccount(publicKey)
      .order('desc')
      .limit(horizonLimit)
      .call();

    const results: WalletPayment[] = [];
    for (const eff of page.records) {
      const isCredit = eff.type === 'account_credited';
      const isDebit = eff.type === 'account_debited';
      if (!isCredit && !isDebit) continue;

      const e = eff as typeof eff & {
        amount?: string;
        asset_code?: string;
        asset_issuer?: string;
      };
      if (e.asset_code !== TESOURO_CODE || e.asset_issuer !== TESOURO_ISSUER) continue;
      if (!e.amount) continue;

      results.push({
        id: eff.id,
        hash: '',
        direction: isCredit ? 'in' : 'out',
        amount: e.amount,
        amountBRL: formatBRL(e.amount),
        brlCentavos: 0,
        feeCentavos: 0,
        feeBRL: 'R$ 0,00',
        when: formatRelativeDate(eff.created_at),
        createdAt: eff.created_at,
      });

      if (results.length >= limit) break;
    }
    return results;
  } catch {
    return [];
  }
}

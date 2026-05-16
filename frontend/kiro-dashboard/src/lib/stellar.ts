import { Horizon, Networks, TransactionBuilder } from '@stellar/stellar-sdk';

const networkKey = (import.meta.env.VITE_STELLAR_NETWORK ?? 'TESTNET') as keyof typeof Networks;


export const NETWORK_PASSPHRASE: string = Networks[networkKey];

export const WALLET_NETWORK = networkKey === 'TESTNET' ? 'TESTNET' : 'PUBLIC';

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

export async function submitXdr(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const result = await horizonServer.submitTransaction(tx);
  return result.hash;
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
  /** Localized relative timestamp: "Hoje, 14:32" / "Ontem, 18:45" / "12 jan, 14:32". */
  when: string;
  /** ISO 8601 creation timestamp from Horizon. */
  createdAt: string;
}

function formatRelativeDate(iso: string): string {
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
 * Returns the most recent TESOURO payments touching this wallet (sent or received).
 * Empty array if the issuer isn't configured or Horizon is unreachable.
 */
export async function fetchTesouroPayments(
  publicKey: string,
  limit = 10,
): Promise<WalletPayment[]> {
  if (!TESOURO_ISSUER) return [];
  try {
    const page = await horizonServer
      .payments()
      .forAccount(publicKey)
      .order('desc')
      .limit(limit)
      .call();

    const results: WalletPayment[] = [];
    for (const op of page.records) {
      if (op.type !== 'payment') continue;
      if (!('asset_code' in op) || !('asset_issuer' in op)) continue;
      if (op.asset_code !== TESOURO_CODE || op.asset_issuer !== TESOURO_ISSUER) continue;

      const isOutgoing = op.from === publicKey;
      results.push({
        id: op.id,
        hash: op.transaction_hash,
        direction: isOutgoing ? 'out' : 'in',
        amount: op.amount,
        amountBRL: formatBRL(op.amount),
        when: formatRelativeDate(op.created_at),
        createdAt: op.created_at,
      });
    }
    return results;
  } catch {
    return [];
  }
}

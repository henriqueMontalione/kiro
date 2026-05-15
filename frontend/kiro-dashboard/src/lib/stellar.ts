import { Horizon, Networks } from '@stellar/stellar-sdk';

const networkKey = (import.meta.env.VITE_STELLAR_NETWORK ?? 'TESTNET') as keyof typeof Networks;

/**
 * Network passphrase derived from the SDK's Networks constant — not stored
 * in env or source, since these are well-known public strings, not secrets.
 */
export const NETWORK_PASSPHRASE: string = Networks[networkKey];

export const WALLET_NETWORK = networkKey === 'TESTNET' ? 'TESTNET' : 'PUBLIC';

export const TESOURO_CODE: string = import.meta.env.VITE_TESOURO_CODE ?? 'TESOURO';
export const TESOURO_ISSUER: string = import.meta.env.VITE_TESOURO_ISSUER ?? '';

const horizonUrl =
  import.meta.env.VITE_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

const horizonServer = new Horizon.Server(horizonUrl);

/**
 * Returns the raw TESOURO balance string (e.g. "1000.0000000") for a wallet,
 * "0.0000000" if the trustline exists with zero balance,
 * or null if the issuer is unconfigured / account unreachable.
 */
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

/** Formats a raw Stellar balance string as Brazilian Real (e.g. "1000.5" → "R$ 1.000,50"). */
export function formatBRL(rawBalance: string): string {
  const num = parseFloat(rawBalance);
  if (isNaN(num)) return 'R$ 0,00';
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** G1AB…XZ9K */
export function truncateKey(key: string): string {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

import { Horizon, Networks } from '@stellar/stellar-sdk';

const networkKey = (import.meta.env.VITE_STELLAR_NETWORK ?? 'TESTNET') as keyof typeof Networks;

/**
 * Network passphrase derived from the SDK's Networks constant — not stored
 * in env or source, since these are well-known public strings, not secrets.
 */
export const NETWORK_PASSPHRASE: string = Networks[networkKey];

export const WALLET_NETWORK = networkKey === 'TESTNET' ? 'TESTNET' : 'PUBLIC';

const horizonUrl =
  import.meta.env.VITE_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

const horizonServer = new Horizon.Server(horizonUrl);

/** Returns the native XLM balance for a public key, or null if unfunded/unreachable. */
export async function fetchXlmBalance(publicKey: string): Promise<string | null> {
  try {
    const account = await horizonServer.loadAccount(publicKey);
    const native = account.balances.find((b) => b.asset_type === 'native');
    return native ? parseFloat(native.balance).toFixed(2) : '0.00';
  } catch {
    return null;
  }
}

/** G1AB…XZ9K */
export function truncateKey(key: string): string {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

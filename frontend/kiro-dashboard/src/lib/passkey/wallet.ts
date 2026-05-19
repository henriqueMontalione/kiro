/**
 * Glue between the passkey ceremony, the AES-GCM crypto, and the Stellar SDK.
 *
 * Threat model summary:
 * - The Ed25519 seed is generated locally, encrypted with a passkey-derived
 *   AES key, and stored as an opaque blob in localStorage.
 * - The blob is meaningless without the passkey (PRF output), which lives in
 *   the device's Secure Enclave / TPM and never leaves it.
 * - On every signing operation we re-prompt biometric — no key caching.
 * - The plaintext seed exists in JS memory for the ~milliseconds between
 *   decryption and signing, then is wiped (best-effort).
 */

import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, WALLET_NETWORK } from '@/lib/stellar';
import {
  authenticatePasskey,
  createPasskey,
  isPasskeySupported,
} from './webauthn';
import {
  base64ToBytes,
  bytesToBase64,
  decryptBytes,
  encryptBytes,
  importAesKey,
  wipeBytes,
} from './crypto';

const STORAGE_KEY = 'kiro_passkey_wallet_v1';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

interface StoredWallet {
  version: 1;
  credentialIdB64: string;
  encryptedSecretB64: string;
  ivB64: string;
  publicKey: string;
  createdAt: string;
}

export { isPasskeySupported };

export function getStoredPasskeyWallet(): StoredWallet | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWallet;
    // Cheap structural validation — anything malformed is treated as absent
    // rather than thrown to the caller, so a corrupted entry can be replaced.
    if (
      parsed.version !== 1 ||
      typeof parsed.credentialIdB64 !== 'string' ||
      typeof parsed.encryptedSecretB64 !== 'string' ||
      typeof parsed.ivB64 !== 'string' ||
      typeof parsed.publicKey !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hasPasskeyWallet(): boolean {
  return getStoredPasskeyWallet() !== null;
}

/**
 * Drop the local blob. Does NOT delete the passkey credential — only the
 * authenticator (OS / browser settings) can do that. Without the blob the
 * passkey is harmless (no encrypted material to decrypt against).
 */
export function forgetPasskeyWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Onboard: create a passkey, generate a Stellar keypair, encrypt the seed
 * under a PRF-derived key, and persist the blob. Returns the public key.
 *
 * If a wallet already exists locally we refuse — the caller can call
 * `forgetPasskeyWallet()` first if a fresh start is intentional.
 */
export async function createPasskeyWallet(userName = 'Lojista Kiro'): Promise<string> {
  if (hasPasskeyWallet()) {
    throw new Error(
      'Já existe uma conta passkey neste navegador. Desconecte antes de criar outra.',
    );
  }

  const reg = await createPasskey(userName);

  let seed: Uint8Array | null = null;
  try {
    const aesKey = await importAesKey(reg.prfOutput);

    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    // Copy into a Uint8Array we own so we control its lifecycle.
    seed = new Uint8Array(keypair.rawSecretKey());

    const blob = await encryptBytes(aesKey, seed);

    const stored: StoredWallet = {
      version: 1,
      credentialIdB64: bytesToBase64(reg.credentialId),
      encryptedSecretB64: bytesToBase64(blob.ciphertext),
      ivB64: bytesToBase64(blob.iv),
      publicKey,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));


    if (WALLET_NETWORK === 'TESTNET') {
      try {
        await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
      } catch (err) {
        console.warn('[passkey] friendbot fund failed (non-fatal):', err);
      }
    }

    return publicKey;
  } finally {
    if (seed) wipeBytes(seed);
    seed = null;
  }
}

/**
 * Authenticate with the stored passkey and return the public key. The blob
 * is NOT decrypted here — we only confirm the user can authenticate. The
 * decryption happens lazily inside `signXdrWithPasskey()` when actually
 * signing, minimizing time the seed is plaintext in memory.
 */
export async function loginWithPasskey(): Promise<string> {
  const stored = getStoredPasskeyWallet();
  if (!stored) throw new Error('Nenhuma conta passkey neste navegador.');

  await authenticatePasskey(base64ToBytes(stored.credentialIdB64));

  return stored.publicKey;
}

/**
 * Sign an XDR transaction envelope with the locally-stored, passkey-protected
 * seed. Re-prompts biometric on every call by design.
 */
export async function signXdrWithPasskey(xdr: string): Promise<string> {
  const stored = getStoredPasskeyWallet();
  if (!stored) throw new Error('Nenhuma conta passkey encontrada.');

  const auth = await authenticatePasskey(base64ToBytes(stored.credentialIdB64));

  let seed: Uint8Array | null = null;
  let keypair: Keypair | null = null;
  try {
    const aesKey = await importAesKey(auth.prfOutput);
    seed = await decryptBytes(aesKey, {
      ciphertext: base64ToBytes(stored.encryptedSecretB64),
      iv: base64ToBytes(stored.ivB64),
    });

    keypair = Keypair.fromRawEd25519Seed(seed);
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    tx.sign(keypair);
    return tx.toXDR();
  } finally {
    if (seed) wipeBytes(seed);
    seed = null;
    keypair = null;
  }
}

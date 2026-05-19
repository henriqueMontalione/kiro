/**
 * AES-GCM helpers on the WebCrypto API.
 *
 * The 32-byte PRF output from a passkey becomes a non-extractable
 * AES-256-GCM key. `importKey` is marked non-extractable so the raw bytes
 * can never be read back out of the CryptoKey handle by JavaScript.
 *
 * Per NIST SP 800-38D, AES-GCM IVs are 12 random bytes and MUST never
 * repeat under the same key. We generate a fresh IV per encryption.
 */

/** Import the 32-byte PRF output as a non-extractable AES-256-GCM key. */
export async function importAesKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    prfOutput,
    { name: 'AES-GCM' },
    false, // non-extractable — raw bytes cannot leave the CryptoKey handle
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedBlob {
  /** Ciphertext bytes — includes the 16-byte GCM auth tag at the end. */
  ciphertext: Uint8Array;
  /** 12-byte IV. Unique per encryption. */
  iv: Uint8Array;
}

// TypeScript 5.7+ tightened the typing on Web Crypto APIs to require
// `Uint8Array<ArrayBuffer>` (not `Uint8Array<ArrayBufferLike>`). Our buffers
// are runtime-safe but TS can't always narrow that, so we cast to
// `BufferSource` at the call boundary. The runtime accepts both equally.

export async function encryptBytes(key: CryptoKey, plaintext: Uint8Array): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  return { ciphertext: new Uint8Array(cipherBuf), iv };
}

export async function decryptBytes(key: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: blob.iv as BufferSource },
    key,
    blob.ciphertext as BufferSource,
  );
  return new Uint8Array(plain);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * Best-effort zeroing of sensitive bytes before they go out of scope.
 * JavaScript GC may keep copies, so treat this as defense-in-depth, not
 * a guarantee. Important enough to do anyway given the value at stake.
 */
export function wipeBytes(bytes: Uint8Array): void {
  bytes.fill(0);
}

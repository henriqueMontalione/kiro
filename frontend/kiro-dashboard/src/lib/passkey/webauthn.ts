/**
 * WebAuthn ceremonies for the passkey-protected Stellar wallet.
 *
 * Uses the PRF extension (Pseudo-Random Function) to derive deterministic
 * 32-byte material from the authenticator. Same credential + same salt
 * always yields the same bytes — that property is what lets us use it as
 * the AES-GCM key that protects the locally-stored Ed25519 secret.
 *
 * Security choices:
 * - `userVerification: 'required'` forces biometric/PIN on every ceremony
 * - PRF salt is app-scoped (`kiro.wallet.prf.v1`) so a leaked credential
 *   from another app can't decrypt our blobs
 * - PRF output is never logged or persisted; it lives only long enough
 *   to derive a CryptoKey
 * - `attestation: 'none'` — we don't track the authenticator, user privacy
 */

// PRF extension types — not yet in stock lib.dom typings (May 2026).
interface PRFEval {
  first: BufferSource;
  second?: BufferSource;
}
interface PRFExtensionInput {
  eval?: PRFEval;
  evalByCredential?: Record<string, PRFEval>;
}
interface PRFExtensionOutput {
  results?: { first?: ArrayBuffer; second?: ArrayBuffer };
  enabled?: boolean;
}
interface ExtensionInputs extends AuthenticationExtensionsClientInputs {
  prf?: PRFExtensionInput;
}
interface ExtensionOutputs extends AuthenticationExtensionsClientOutputs {
  prf?: PRFExtensionOutput;
}

// Bumping this version invalidates all existing local blobs — only do it
// on a deliberate breaking change to the key-derivation scheme.
const PRF_SALT = new TextEncoder().encode('kiro.wallet.prf.v1');

const RP_NAME = 'Kiro';

function getRpId(): string {
  return window.location.hostname;
}

export interface PasskeyRegistrationResult {
  credentialId: Uint8Array;
  prfOutput: ArrayBuffer;
}

export interface PasskeyAuthResult {
  prfOutput: ArrayBuffer;
}

/** Quick capability check for the calling UI to decide whether to offer the flow. */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials?.create === 'function'
  );
}

/**
 * Create a new passkey credential + extract the PRF output for key derivation.
 * The caller must immediately use the PRF output and let it go out of scope.
 */
export async function createPasskey(userName: string): Promise<PasskeyRegistrationResult> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys não são suportadas neste navegador.');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userHandle = crypto.getRandomValues(new Uint8Array(16));

  const extensions: ExtensionInputs = {
    prf: { eval: { first: PRF_SALT } },
  };

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: getRpId(), name: RP_NAME },
      user: { id: userHandle, name: userName, displayName: userName },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256 — primary
        { alg: -257, type: 'public-key' }, // RS256 — broader compat fallback
      ],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      attestation: 'none',
      timeout: 60_000,
      extensions: extensions as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error('Criação da passkey foi cancelada.');

  const extResults = cred.getClientExtensionResults() as ExtensionOutputs;
  const prfOutput = extResults.prf?.results?.first;

  if (!prfOutput) {
    throw new Error(
      'Seu navegador criou a passkey mas não suporta a extensão PRF necessária. ' +
        'Use Chrome 116+, Safari 18+ ou Firefox 129+.',
    );
  }

  return {
    credentialId: new Uint8Array(cred.rawId),
    prfOutput,
  };
}

/**
 * Re-authenticate with an existing passkey. PRF output is deterministic for
 * the same credential + salt, so this yields the same bytes used at creation.
 */
export async function authenticatePasskey(credentialId: Uint8Array): Promise<PasskeyAuthResult> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys não são suportadas neste navegador.');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const extensions: ExtensionInputs = {
    prf: { eval: { first: PRF_SALT } },
  };

  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: getRpId(),
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: extensions as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error('Autenticação cancelada.');

  const extResults = cred.getClientExtensionResults() as ExtensionOutputs;
  const prfOutput = extResults.prf?.results?.first;

  if (!prfOutput) {
    throw new Error('PRF não disponível na autenticação. Atualize o navegador.');
  }

  return { prfOutput };
}

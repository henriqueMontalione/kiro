import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  Keypair,
  TransactionBuilder,
  Transaction,
  FeeBumpTransaction,
  Operation,
  Networks,
  BASE_FEE,
  Horizon,
  StrKey,
} from '@stellar/stellar-sdk';

/**
 * Stellar account activation and transaction submission proxy.
 *
 * Two endpoints:
 *   POST /api/stellar-activate  — creates a lojista's Stellar account if it
 *     doesn't exist yet. Testnet: delegates to friendbot. Mainnet: sponsor
 *     wallet funds the account with 1.5 XLM (base reserve + one trustline).
 *
 *   POST /api/stellar-submit  — accepts a lojista-signed inner XDR and, on
 *     mainnet, wraps it in a fee-bump envelope so the sponsor pays the network
 *     fee. On testnet submits directly (friendbot-funded accounts have XLM).
 *
 * Security:
 *   - Both endpoints require a valid Privy JWT (Authorization: Bearer <token>).
 *   - All inputs are validated before any on-chain action.
 *   - The sponsor's private key (STELLAR_SPONSOR_SECRET) lives only here —
 *     never in the browser bundle.
 */

const NETWORK = (process.env.VITE_STELLAR_NETWORK ?? 'TESTNET') as 'PUBLIC' | 'TESTNET';
const IS_MAINNET = NETWORK === 'PUBLIC';
const HORIZON_URL =
  process.env.VITE_HORIZON_URL ??
  (IS_MAINNET ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org');
const NETWORK_PASSPHRASE = IS_MAINNET ? Networks.PUBLIC : Networks.TESTNET;
const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const PRIVY_APP_ID = process.env.VITE_PRIVY_APP_ID ?? '';

const server = new Horizon.Server(HORIZON_URL);

// 10× the minimum base fee keeps fee-bump transactions out of the surge-pricing
// queue without meaningfully increasing sponsor costs at current XLM prices.
const FEE = String(10 * parseInt(BASE_FEE)); // "1000" stroops

// Module-level JWKS fetcher — caches the key set between invocations.
const JWKS = PRIVY_APP_ID
  ? createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/.well-known/jwks.json`),
    )
  : null;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Verifies the Privy Bearer JWT from the Authorization header.
 * Throws with statusCode 401 on any failure so the outer catch can map it.
 */
async function verifyPrivyAuth(req: Request): Promise<string> {
  if (!JWKS || !PRIVY_APP_ID) {
    throw Object.assign(new Error('PRIVY_APP_ID não configurado'), { statusCode: 500 });
  }
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    throw Object.assign(new Error('Não autorizado'), { statusCode: 401 });
  }
  const token = auth.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'privy.io',
      audience: PRIVY_APP_ID,
    });
    return payload.sub as string; // Privy user DID
  } catch {
    throw Object.assign(new Error('Token inválido ou expirado'), { statusCode: 401 });
  }
}

function getSponsorKeypair(): Keypair {
  const secret = process.env.STELLAR_SPONSOR_SECRET;
  if (!secret) throw new Error('STELLAR_SPONSOR_SECRET não configurado');
  return Keypair.fromSecret(secret);
}

/** Extracts the most useful error string from a Horizon submit failure. */
function horizonError(err: unknown): string {
  const e = err as {
    response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } };
    message?: string;
  };
  const rc = e?.response?.data?.extras?.result_codes;
  if (rc) {
    const ops = rc.operations?.length ? `, ops=[${rc.operations.join(',')}]` : '';
    return `tx_result=${rc.transaction ?? 'unknown'}${ops}`;
  }
  return e?.message ?? 'Erro desconhecido';
}

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const method = req.method;

  try {
    // ── POST /api/stellar-activate ──────────────────────────────────────────
    if (url.pathname === '/api/stellar-activate' && method === 'POST') {
      await verifyPrivyAuth(req);

      const body = (await req.json()) as { publicKey?: unknown };
      if (typeof body.publicKey !== 'string' || !StrKey.isValidEd25519PublicKey(body.publicKey)) {
        return json({ error: 'Chave pública Stellar inválida' }, 400);
      }
      const { publicKey } = body as { publicKey: string };

      // Idempotent: return early if the account already exists on-chain.
      try {
        await server.loadAccount(publicKey);
        return json({ funded: false, existed: true });
      } catch {
        // 404 from Horizon → account does not exist, proceed to create it.
      }

      if (!IS_MAINNET) {
        const fbRes = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
        if (!fbRes.ok) {
          const text = await fbRes.text();
          console.error('[stellar-activate] friendbot failed:', text.slice(0, 200));
          return json({ error: 'Friendbot falhou' }, 502);
        }
        return json({ funded: true, existed: false });
      }

      // Mainnet: sponsor creates the account.
      // 1.5 XLM = base reserve (1 XLM) + one trustline reserve (0.5 XLM for TESOURO).
      // All transaction fees are covered by fee-bump, so the lojista never
      // needs liquid XLM beyond these locked reserves.
      const sponsorKeypair = getSponsorKeypair();
      const sponsorAccount = await server.loadAccount(sponsorKeypair.publicKey());

      const tx = new TransactionBuilder(sponsorAccount, { fee: FEE, networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(Operation.createAccount({ destination: publicKey, startingBalance: '1.5' }))
        .setTimeout(30)
        .build();
      tx.sign(sponsorKeypair);

      try {
        await server.submitTransaction(tx);
      } catch (err) {
        const msg = horizonError(err);
        console.error('[stellar-activate] submit failed:', msg);
        return json({ error: msg }, 400);
      }

      return json({ funded: true, existed: false });
    }

    // ── POST /api/stellar-submit ────────────────────────────────────────────
    if (url.pathname === '/api/stellar-submit' && method === 'POST') {
      await verifyPrivyAuth(req);

      const body = (await req.json()) as { signedXdr?: unknown };
      if (typeof body.signedXdr !== 'string' || body.signedXdr.length === 0) {
        return json({ error: 'XDR inválido' }, 400);
      }
      const { signedXdr } = body as { signedXdr: string };

      let innerTx: Transaction | FeeBumpTransaction;
      try {
        innerTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      } catch {
        return json({ error: 'XDR malformado' }, 400);
      }

      if (!IS_MAINNET) {
        // Testnet: friendbot-funded accounts have enough XLM to pay fees directly.
        try {
          const result = await server.submitTransaction(innerTx as Transaction);
          return json({ hash: result.hash });
        } catch (err) {
          const msg = horizonError(err);
          console.error('[stellar-submit] testnet submit failed:', msg);
          return json({ error: msg }, 400);
        }
      }

      // Mainnet: wrap in a fee-bump so the sponsor pays the network fee.
      // If it's already a fee-bump (e.g., rebuilt elsewhere), submit as-is.
      if (innerTx instanceof FeeBumpTransaction) {
        try {
          const result = await server.submitTransaction(innerTx);
          return json({ hash: result.hash });
        } catch (err) {
          const msg = horizonError(err);
          console.error('[stellar-submit] fee-bump (pre-built) failed:', msg);
          return json({ error: msg }, 400);
        }
      }

      const sponsorKeypair = getSponsorKeypair();
      const feeBump = TransactionBuilder.buildFeeBumpTransaction(
        sponsorKeypair,
        FEE,
        innerTx as Transaction,
        NETWORK_PASSPHRASE,
      );
      feeBump.sign(sponsorKeypair);

      try {
        const result = await server.submitTransaction(feeBump);
        return json({ hash: result.hash });
      } catch (err) {
        const msg = horizonError(err);
        console.error('[stellar-submit] fee-bump failed:', msg);
        return json({ error: msg }, 400);
      }
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const status = e.statusCode ?? 500;
    if (status === 401) {
      console.warn('[stellar] Unauthorized:', req.headers.get('Authorization') ? 'token inválido' : 'sem token');
    } else {
      console.error('[stellar]', e.message);
    }
    return json({ error: e.message ?? 'Internal error' }, status);
  }
};

export const config = {
  path: ['/api/stellar-activate', '/api/stellar-submit'],
};

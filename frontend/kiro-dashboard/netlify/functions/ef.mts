import { randomUUID } from 'node:crypto';

/**
 * Etherfuse off/on-ramp proxy — production counterpart of the `etherfuseApi`
 * Vite plugin in `vite.config.ts`. Same endpoints, same shapes, same recovery
 * logic for the "wallet already onboarded" 409.
 *
 * Reads ETHERFUSE_API_KEY from server-side env vars so the key never reaches
 * the browser bundle.
 */

const API_KEY = process.env.ETHERFUSE_API_KEY ?? '';
const BASE_URL = (process.env.ETHERFUSE_BASE_URL ?? 'https://api.sand.etherfuse.com').replace(/\/$/, '');
const TESOURO_ASSET = `${process.env.VITE_TESOURO_CODE ?? 'TESOURO'}:${process.env.VITE_TESOURO_ISSUER ?? ''}`;

interface ErrorWithStatus extends Error {
  status?: number;
}

async function efetch(method: string, pathname: string, body?: unknown) {
  const res = await fetch(BASE_URL + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: API_KEY },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();

  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) {
        console.error(`[ef] ${method} ${pathname} → ${res.status}:`, text.slice(0, 300));
        const err: ErrorWithStatus = new Error(text.slice(0, 200));
        err.status = res.status;
        throw err;
      }
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const errObj = (data as { error?: { message?: string }; message?: string }).error;
    const msg = errObj?.message ?? (data as { message?: string }).message ?? `HTTP ${res.status}`;
    console.error(`[ef] ${method} ${pathname} → ${res.status}:`, JSON.stringify(data).slice(0, 300));
    const err: ErrorWithStatus = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const method = req.method;

  try {
    // POST /api/ef-onboarding — onboards a wallet, recovering existing
    // customer if the wallet is already registered under another org.
    if (url.pathname === '/api/ef-onboarding' && method === 'POST') {
      const body = (await req.json()) as { customerId: string; bankAccountId: string; publicKey: string };
      let { customerId, bankAccountId } = body;
      const { publicKey } = body;

      const tryOnboard = (cid: string, bid: string) =>
        efetch('POST', '/ramp/onboarding-url', {
          customerId: cid, bankAccountId: bid, publicKey, blockchain: 'stellar',
        }) as Promise<{ presigned_url: string }>;

      try {
        const data = await tryOnboard(customerId, bankAccountId);
        return json({ customerId, bankAccountId, kycUrl: data.presigned_url });
      } catch (err) {
        const e = err as ErrorWithStatus;
        const match = e.message.match(/see org:\s*([0-9a-f-]+)/i);
        if (!match) throw err;

        const existingCustomerId = match[1];
        console.log('[ef] wallet already onboarded under customer', existingCustomerId);

        try {
          const accountsData = (await efetch('POST', `/ramp/customer/${existingCustomerId}/bank-accounts`, {
            pageSize: 10, pageNumber: 0,
          })) as { items?: Array<{ bankAccountId: string }> };
          const accounts = accountsData.items ?? [];
          if (accounts.length > 0) bankAccountId = accounts[0].bankAccountId;
        } catch { /* keep new bankAccountId — onboarding will create it */ }

        const data = await tryOnboard(existingCustomerId, bankAccountId);
        return json({ customerId: existingCustomerId, bankAccountId, kycUrl: data.presigned_url });
      }
    }

    // GET /api/ef-kyc-status?customerId=...&publicKey=...
    if (url.pathname === '/api/ef-kyc-status' && method === 'GET') {
      const customerId = url.searchParams.get('customerId');
      const publicKey = url.searchParams.get('publicKey');
      try {
        const data = await efetch('GET', `/ramp/customer/${customerId}/kyc/${publicKey}`);
        return json({ status: (data as { status?: string }).status ?? 'not_started' });
      } catch (err) {
        const e = err as ErrorWithStatus;
        if (e.status === 404 || e.status === 400) return json({ status: 'not_started' });
        throw err;
      }
    }

    // POST /api/ef-bank-accounts
    if (url.pathname === '/api/ef-bank-accounts' && method === 'POST') {
      const { customerId } = (await req.json()) as { customerId: string };
      const data = await efetch('POST', `/ramp/customer/${customerId}/bank-accounts`, {
        pageSize: 10, pageNumber: 0,
      });
      return json({ accounts: (data as { items?: unknown[] }).items ?? [] });
    }

    // POST /api/ef-quote — off-ramp (TESOURO → BRL)
    if (url.pathname === '/api/ef-quote' && method === 'POST') {
      const { customerId, sourceAmount } = (await req.json()) as { customerId: string; sourceAmount: string };
      const quoteId = randomUUID();
      const data = (await efetch('POST', '/ramp/quote', {
        quoteId, customerId, blockchain: 'stellar',
        quoteAssets: { type: 'offramp', sourceAsset: TESOURO_ASSET, targetAsset: 'BRL' },
        sourceAmount,
      })) as Record<string, string | null>;
      return json({
        quoteId: data.quoteId,
        sourceAmount: data.sourceAmount,
        destinationAmount: data.destinationAmountAfterFee ?? data.destinationAmount ?? '0',
        exchangeRate: data.exchangeRate ?? '1',
        fee: data.feeAmount ?? '0',
        expiresAt: data.expiresAt ?? '',
      });
    }

    // POST /api/ef-order — off-ramp
    if (url.pathname === '/api/ef-order' && method === 'POST') {
      const { quoteId, stellarAddress, bankAccountId } = (await req.json()) as {
        quoteId: string; stellarAddress: string; bankAccountId: string;
      };
      const orderId = randomUUID();
      const data = (await efetch('POST', '/ramp/order', {
        orderId, bankAccountId, publicKey: stellarAddress, quoteId,
      })) as { offramp?: { orderId: string } };
      return json({ orderId: data.offramp?.orderId ?? orderId });
    }

    // GET /api/ef-order — poll off-ramp; XDR appears as `burnTransaction`.
    if (url.pathname === '/api/ef-order' && method === 'GET') {
      const orderId = url.searchParams.get('orderId');
      const data = (await efetch('GET', `/ramp/order/${orderId}`)) as Record<string, unknown>;
      return json({
        orderId: data.orderId,
        status: data.status,
        burnTransaction: data.burnTransaction ?? null,
      });
    }

    // POST /api/ef-onramp-quote — on-ramp (BRL → TESOURO)
    if (url.pathname === '/api/ef-onramp-quote' && method === 'POST') {
      const { customerId, sourceAmount } = (await req.json()) as { customerId: string; sourceAmount: string };
      const quoteId = randomUUID();
      const data = (await efetch('POST', '/ramp/quote', {
        quoteId, customerId, blockchain: 'stellar',
        quoteAssets: { type: 'onramp', sourceAsset: 'BRL', targetAsset: TESOURO_ASSET },
        sourceAmount,
      })) as Record<string, string | null>;
      return json({
        quoteId: data.quoteId,
        sourceAmount: data.sourceAmount,
        destinationAmount: data.destinationAmountAfterFee ?? data.destinationAmount ?? '0',
        exchangeRate: data.exchangeRate ?? '1',
        fee: data.feeAmount ?? '0',
        expiresAt: data.expiresAt ?? '',
      });
    }

    // POST /api/ef-onramp-order — returns the PIX deposit details
    if (url.pathname === '/api/ef-onramp-order' && method === 'POST') {
      const { quoteId, stellarAddress, bankAccountId } = (await req.json()) as {
        quoteId: string; stellarAddress: string; bankAccountId: string;
      };
      const orderId = randomUUID();
      const data = (await efetch('POST', '/ramp/order', {
        orderId, bankAccountId, publicKey: stellarAddress, quoteId,
      })) as { onramp?: Record<string, string | undefined> };
      const o = data.onramp ?? {};
      return json({
        orderId: o.orderId ?? orderId,
        depositAmount: o.depositAmount ?? '',
        depositPixKey: o.depositPixKey ?? '',
        depositPixKeyType: o.depositPixKeyType ?? '',
        depositPixCode: o.depositPixCode ?? '',
        beneficiary: o.beneficiary ?? '',
      });
    }

    // GET /api/ef-onramp-order — poll for on-ramp completion
    if (url.pathname === '/api/ef-onramp-order' && method === 'GET') {
      const orderId = url.searchParams.get('orderId');
      const data = (await efetch('GET', `/ramp/order/${orderId}`)) as Record<string, unknown>;
      return json({
        orderId: data.orderId,
        status: data.status,
        confirmedTxSignature: data.confirmedTxSignature ?? null,
        amountInTokens: data.amountInTokens ?? null,
        amountInFiat: data.amountInFiat ?? null,
      });
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    const e = err as ErrorWithStatus;
    console.error('[ef]', e.message);
    return json({ error: e.message ?? 'Internal error' }, e.status ?? 500);
  }
};

// Bind the function to each /api/ef-* route. This bypasses Netlify's redirect
// chain (including the SPA fallback) for these paths, so the function receives
// the original request URL intact.
export const config = {
  path: [
    '/api/ef-onboarding',
    '/api/ef-kyc-status',
    '/api/ef-bank-accounts',
    '/api/ef-quote',
    '/api/ef-order',
    '/api/ef-onramp-quote',
    '/api/ef-onramp-order',
  ],
};

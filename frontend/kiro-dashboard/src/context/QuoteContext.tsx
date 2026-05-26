import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getQuote, startOnboarding } from '@/lib/anchors/etherfuse/client';
import { useDashboard } from './DashboardContext';
import { useWallet } from './WalletContext';

// Bumped from v1 → v2 after a proxy bug cached rate=1 (1 TESOURO == 1 BRL),
// which made BalanceCard show TESOURO units with an "R$" prefix. v2 forces a
// fresh fetch and ignores the broken cached value on next load.
const RATE_KEY = 'kiro_brl_per_tesouro_v2';
const LEGACY_RATE_KEY = 'kiro_brl_per_tesouro';
const CUSTOMER_KEY = 'kiro_ef_customer_id';
const BANK_ACCOUNT_KEY = 'kiro_ef_bank_account_id';
const POLL_MS = 5 * 60 * 1000;

// One-shot migration: drop the legacy key so it doesn't linger forever.
if (typeof window !== 'undefined') localStorage.removeItem(LEGACY_RATE_KEY);

interface QuoteState {
  /** Latest BRL value of 1 TESOURO. `null` until the first successful fetch. */
  brlPerTesouro: number | null;
  /** Format a TESOURO amount as the equivalent BRL string. Returns `null` when the rate is unknown — callers must handle the loading state explicitly. */
  formatTesouroAsBRL: (tesouro: string | number) => string | null;
  /** Convert a BRL amount to TESOURO. Returns null when the rate is unknown. */
  brlToTesouro: (brl: number) => number | null;
  refresh: () => Promise<void>;
}

const QuoteContext = createContext<QuoteState | null>(null);

function formatBRLNumber(num: number): string {
  if (isNaN(num)) return 'R$ 0,00';
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function QuoteProvider({ children }: { children: ReactNode }) {
  const { refreshTick } = useDashboard();
  const { isConnected, publicKey } = useWallet();
  const [brlPerTesouro, setRate] = useState<number | null>(() => {
    const stored = localStorage.getItem(RATE_KEY);
    if (!stored) return null;
    const n = parseFloat(stored);
    return isNaN(n) || n <= 0 ? null : n;
  });

  const fetchRate = useCallback(async () => {
    let customerId = localStorage.getItem(CUSTOMER_KEY);

    // Recover (or create) the customerId proactively when it's missing. The
    // Etherfuse onboarding endpoint returns the existing customerId for any
    // wallet that was already onboarded — same recovery path SacarPixModal
    // relies on. This means the BalanceCard can show a real BRL value right
    // after login, without forcing the lojista to open Sacar/Receber first.
    if (!customerId && publicKey) {
      try {
        const result = await startOnboarding(
          crypto.randomUUID(),
          crypto.randomUUID(),
          publicKey,
        );
        customerId = result.customerId;
        localStorage.setItem(CUSTOMER_KEY, result.customerId);
        localStorage.setItem(BANK_ACCOUNT_KEY, result.bankAccountId);
      } catch (err) {
        console.warn('[QuoteContext] customerId recovery failed:', err);
        return;
      }
    }
    if (!customerId) return;

    try {
      // Off-ramp quote for 1 TESOURO; exchangeRate comes back as BRL per TESOURO.
      const q = await getQuote(customerId, '1');
      const rate = parseFloat(q.exchangeRate);
      if (!rate || rate <= 0) {
        console.warn('[QuoteContext] quote returned invalid rate:', q);
        return;
      }
      setRate(rate);
      localStorage.setItem(RATE_KEY, String(rate));
    } catch (err) {
      console.warn('[QuoteContext] fetchRate failed:', err);
    }
  }, [publicKey]);

  // Single source of truth: only fetch when the wallet is connected.
  // QuoteProvider mounts above the auth gate, so without this guard we'd
  // hit /api/ef-quote (and start the poll) before the user even logs in
  // — wasting a request and leaking the leftover customerId to the proxy.
  useEffect(() => {
    if (!isConnected) {
      localStorage.removeItem(CUSTOMER_KEY);
      localStorage.removeItem(BANK_ACCOUNT_KEY);
      return;
    }
    fetchRate();
    const id = setInterval(fetchRate, POLL_MS);
    return () => clearInterval(id);
  }, [isConnected, fetchRate]);

  useEffect(() => {
    if (isConnected && refreshTick > 0) fetchRate();
  }, [refreshTick, isConnected, fetchRate]);

  // Triggered when ReceberPixModal / SacarPixModal first stores a customerId —
  // lets the quote fetch immediately instead of waiting for the next poll tick.
  useEffect(() => {
    const handler = () => fetchRate();
    window.addEventListener('kiro:customerIdReady', handler);
    return () => window.removeEventListener('kiro:customerIdReady', handler);
  }, [fetchRate]);

  const formatTesouroAsBRL = useCallback(
    (tesouro: string | number): string | null => {
      // Returns null while the rate is unknown so callers must explicitly
      // render a loading state — avoids the historical bug of TESOURO units
      // being displayed with an "R$" prefix.
      if (brlPerTesouro == null || brlPerTesouro <= 0) return null;
      const t = typeof tesouro === 'string' ? parseFloat(tesouro) : tesouro;
      if (isNaN(t)) return 'R$ 0,00';
      return formatBRLNumber(t * brlPerTesouro);
    },
    [brlPerTesouro],
  );

  const brlToTesouro = useCallback(
    (brl: number) => {
      if (brlPerTesouro == null || brlPerTesouro <= 0) return null;
      return brl / brlPerTesouro;
    },
    [brlPerTesouro],
  );

  return (
    <QuoteContext.Provider
      value={{ brlPerTesouro, formatTesouroAsBRL, brlToTesouro, refresh: fetchRate }}
    >
      {children}
    </QuoteContext.Provider>
  );
}

export function useQuote(): QuoteState {
  const ctx = useContext(QuoteContext);
  if (!ctx) throw new Error('useQuote must be used inside <QuoteProvider>');
  return ctx;
}

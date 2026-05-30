import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from './WalletContext';
import { useQuote } from './QuoteContext';
import { useTransactions } from './TransactionsContext';
import { getInvestmentSummary, type InvestmentSummary } from '@/lib/api/transactions';

interface InvestmentState {
  /** Sum of BRL the merchant paid into deposits (gross, includes fees). In centavos. */
  totalPaidCentavos: number;
  /** Sum of BRL received from withdrawals (already net of fees). In centavos. */
  totalReceivedCentavos: number;
  /**
   * Current value of remaining TESOURO valued at the live quote, in centavos.
   * Null until both balance and price are known.
   */
  currentValueCentavos: number | null;
  /**
   * Cumulative profit in centavos: currentValue + cashOut - cashIn.
   * Combines realized (past withdrawals booked at sale price) and unrealized
   * (mark-to-market on remaining tokens) into a single figure. Null until the
   * inputs are loaded.
   */
  yieldCentavos: number | null;
  /** Profit as a percentage of cash invested. Null when nothing invested. */
  yieldPercent: number | null;
  /** Re-fetches aggregates from backend. */
  refresh: () => Promise<void>;
}

const InvestmentContext = createContext<InvestmentState | null>(null);

export function InvestmentProvider({ children }: { children: ReactNode }) {
  const { isConnected, balance } = useWallet();
  const { getAccessToken } = usePrivy();
  const { brlPerTesouro } = useQuote();
  const { payments } = useTransactions();

  const [summary, setSummary] = useState<InvestmentSummary | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!isConnected) { setSummary(null); return; }
    try {
      const token = await getAccessToken();
      if (!token) return;
      const data = await getInvestmentSummary(token);
      setSummary(data);
    } catch (err) {
      console.warn('[Investment] fetch summary failed:', err);
    }
  }, [isConnected, getAccessToken]);

  // Re-fetch on connect and whenever the transaction list changes.
  useEffect(() => { fetchSummary(); }, [fetchSummary, payments.length]);

  const value = useMemo<InvestmentState>(() => {
    const totalPaid = summary?.total_paid_brl_centavos ?? 0;
    const totalReceived = summary?.total_received_brl_centavos ?? 0;

    const tesouro = balance != null ? parseFloat(balance) : null;
    const currentValueCentavos =
      tesouro != null && brlPerTesouro != null
        ? Math.round(tesouro * brlPerTesouro * 100)
        : null;

    const yieldCentavos =
      summary != null && currentValueCentavos != null
        ? currentValueCentavos + totalReceived - totalPaid
        : null;

    const netInvested = totalPaid - totalReceived;
    const yieldPercent =
      yieldCentavos != null && netInvested > 0
        ? (yieldCentavos / netInvested) * 100
        : null;

    return {
      totalPaidCentavos: totalPaid,
      totalReceivedCentavos: totalReceived,
      currentValueCentavos,
      yieldCentavos,
      yieldPercent,
      refresh: fetchSummary,
    };
  }, [summary, balance, brlPerTesouro, fetchSummary]);

  return (
    <InvestmentContext.Provider value={value}>{children}</InvestmentContext.Provider>
  );
}

export function useInvestment(): InvestmentState {
  const ctx = useContext(InvestmentContext);
  if (!ctx) throw new Error('useInvestment must be used inside <InvestmentProvider>');
  return ctx;
}

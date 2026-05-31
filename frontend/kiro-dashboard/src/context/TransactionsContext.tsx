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
import {
  listTransactions,
  type Transaction,
  centavosToBRL,
  stroopsToTesouro,
} from '@/lib/api/transactions';
import { formatRelativeDate, type WalletPayment } from '@/lib/stellar';

interface TransactionsState {
  payments: WalletPayment[];
  isLoading: boolean;
  errorMessage: string | null;
  refresh: () => Promise<void>;
}

const TransactionsContext = createContext<TransactionsState | null>(null);

function toPayment(t: Transaction): WalletPayment {
  const fee = t.fee_brl_amount ?? 0;
  return {
    id: t.id,
    hash: t.stellar_tx_hash ?? '',
    direction: t.direction,
    amount: stroopsToTesouro(t.tesouro_amount),
    amountBRL: centavosToBRL(t.brl_amount),
    brlCentavos: t.brl_amount,
    feeCentavos: fee,
    feeBRL: centavosToBRL(fee),
    when: formatRelativeDate(t.created_at),
    createdAt: t.created_at,
  };
}

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useWallet();
  const { getAccessToken } = usePrivy();

  const [payments, setPayments] = useState<WalletPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMessage('Sessão expirada');
        return;
      }
      const txs = await listTransactions(token);
      setPayments(txs.map(toPayment));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar transações');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, getAccessToken]);

  useEffect(() => {
    if (!isConnected) {
      setPayments([]);
      return;
    }
    refresh();
  }, [isConnected, refresh]);

  const value = useMemo(
    () => ({ payments, isLoading, errorMessage, refresh }),
    [payments, isLoading, errorMessage, refresh],
  );

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
}

export function useTransactions(): TransactionsState {
  const ctx = useContext(TransactionsContext);
  if (!ctx) throw new Error('useTransactions must be used inside <TransactionsProvider>');
  return ctx;
}

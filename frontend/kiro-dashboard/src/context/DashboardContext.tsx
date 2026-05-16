import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useWallet } from './WalletContext';

interface DashboardState {
  /** When true, all currency values across the Resumo screen are blurred. */
  valuesHidden: boolean;
  toggleValuesHidden: () => void;
  /** Increments whenever the user clicks "refresh". Cards include this in their
   *  `useEffect` deps so a manual refresh forces a re-fetch even if the
   *  underlying balance string is unchanged. */
  refreshTick: number;
  /** Refreshes wallet balance and bumps `refreshTick`. `isRefreshing` reflects the in-flight state. */
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { refreshBalance } = useWallet();
  const [valuesHidden, setValuesHidden] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const toggleValuesHidden = useCallback(() => {
    setValuesHidden((h) => !h);
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshBalance();
      setRefreshTick((t) => t + 1);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshBalance]);

  return (
    <DashboardContext.Provider
      value={{ valuesHidden, toggleValuesHidden, refreshTick, refresh, isRefreshing }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardState {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside <DashboardProvider>');
  return ctx;
}

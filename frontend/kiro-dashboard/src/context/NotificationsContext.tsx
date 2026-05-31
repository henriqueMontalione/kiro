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
import { useTransactions } from './TransactionsContext';
import { useWallet } from './WalletContext';
import { getNotificationsLastSeen, markNotificationsRead } from '@/lib/api/notifications';
import type { WalletPayment } from '@/lib/stellar';

export interface Notification {
  id: string;
  direction: 'in' | 'out';
  title: string;
  ago: string;
  createdAt: string;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

function buildTitle(p: WalletPayment): string {
  if (p.direction === 'in') return `Você recebeu ${p.amountBRL} via PIX`;
  return `Saque de ${p.amountBRL} concluído`;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { payments } = useTransactions();
  const { isConnected } = useWallet();
  const { getAccessToken } = usePrivy();
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) { setLastSeen(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const ts = await getNotificationsLastSeen(token);
        if (!cancelled) setLastSeen(ts);
      } catch (err) {
        console.warn('[Notifications] fetch last_seen failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, getAccessToken]);

  const notifications = useMemo<Notification[]>(
    () =>
      payments.slice(0, 20).map((p) => ({
        id: p.id,
        direction: p.direction,
        title: buildTitle(p),
        ago: p.when,
        createdAt: p.createdAt,
      })),
    [payments],
  );

  const unreadCount = useMemo(() => {
    if (!notifications.length) return 0;
    if (!lastSeen) return notifications.length;
    return notifications.filter((n) => n.createdAt > lastSeen).length;
  }, [notifications, lastSeen]);

  const markAllRead = useCallback(() => {
    if (!notifications.length) return;
    const newest = notifications[0].createdAt;
    setLastSeen(newest);
    getAccessToken()
      .then((token) => {
        if (token) return markNotificationsRead(token, newest);
      })
      .catch((err) => console.warn('[Notifications] mark read failed:', err));
  }, [notifications, getAccessToken]);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}

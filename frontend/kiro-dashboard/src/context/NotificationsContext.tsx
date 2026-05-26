import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTransactions } from './TransactionsContext';
import type { WalletPayment } from '@/lib/stellar';

const SEEN_KEY = 'kiro_notifications_last_seen';

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
  const [lastSeen, setLastSeen] = useState<string>(
    () => localStorage.getItem(SEEN_KEY) ?? '',
  );

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
    localStorage.setItem(SEEN_KEY, newest);
  }, [notifications]);

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

import { useEffect } from 'react';
import { ChevronRight, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { Card } from '../Card';
import { useWallet } from '@/context/WalletContext';
import { useDashboard } from '@/context/DashboardContext';
import { useTransactions } from '@/context/TransactionsContext';
import type { WalletPayment } from '@/lib/stellar';

interface MobileActivityCardProps {
  onSeeAll: () => void;
  /** Limit the number of rows rendered. Keeps the home screen scannable. */
  limit?: number;
}

/**
 * Condensed "Atividade Recente" list for the mobile home. Reads the most recent
 * TESOURO movements from the backend transactions log.
 */
export function MobileActivityCard({ onSeeAll, limit = 3 }: MobileActivityCardProps) {
  const { isConnected } = useWallet();
  const { valuesHidden, refreshTick } = useDashboard();
  const { payments: allPayments, refresh } = useTransactions();
  const payments: WalletPayment[] | null = isConnected ? allPayments.slice(0, limit) : null;

  useEffect(() => {
    if (refreshTick > 0) refresh();
  }, [refreshTick, refresh]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-[14px] font-semibold text-[var(--fg-1)]">
          Atividade Recente
        </span>
        <button
          type="button"
          onClick={onSeeAll}
          className="inline-flex items-center gap-1 bg-transparent border-none text-[var(--kiro-green)] font-display text-[13px] font-medium cursor-pointer"
          style={{ minHeight: 32 }}
        >
          Ver todas <ChevronRight size={14} strokeWidth={1.8} />
        </button>
      </div>

      {!isConnected && (
        <div className="text-center text-[var(--fg-3)] text-[13px]" style={{ padding: '16px 0' }}>
          Conecte sua carteira para ver suas movimentações.
        </div>
      )}
      {isConnected && payments === null && <MobileSkeleton count={limit} />}
      {isConnected && payments && payments.length === 0 && (
        <div className="text-center text-[var(--fg-3)] text-[13px]" style={{ padding: '16px 0' }}>
          Nenhuma movimentação registrada ainda.
        </div>
      )}

      <ul className="flex flex-col gap-1 list-none m-0 p-0">
        {payments?.map((p) => (
          <li key={p.id}>
            <ActivityRow payment={p} valuesHidden={valuesHidden} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MobileSkeleton({ count }: { count: number }) {
  return (
    <ul className="flex flex-col gap-1 list-none m-0 p-0">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-[12px]"
          style={{ padding: '10px 4px', minHeight: 56 }}
        >
          <div
            className="rounded-[10px] animate-pulse flex-shrink-0"
            style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.04)' }}
          />
          <div className="flex flex-col gap-2 flex-1">
            <div
              className="rounded animate-pulse"
              style={{ height: 12, width: '60%', background: 'rgba(255,255,255,0.04)' }}
            />
            <div
              className="rounded animate-pulse"
              style={{ height: 10, width: '40%', background: 'rgba(255,255,255,0.04)' }}
            />
          </div>
          <div
            className="rounded animate-pulse"
            style={{ height: 14, width: 80, background: 'rgba(255,255,255,0.04)' }}
          />
        </li>
      ))}
    </ul>
  );
}

function ActivityRow({ payment, valuesHidden }: { payment: WalletPayment; valuesHidden: boolean }) {
  const isOut = payment.direction === 'out';
  const Icon = isOut ? ArrowUpRight : ShoppingBag;
  const label = isOut ? 'Saque via PIX' : 'Pagamento recebido';

  const iconBg = isOut ? 'rgba(123,44,191,0.16)' : 'rgba(0,255,135,0.10)';
  const iconColor = isOut ? '#C99EFA' : 'var(--kiro-green)';
  const amountColor = isOut ? '#FF4D6D' : 'var(--kiro-green)';

  return (
    <div
      className="flex items-center gap-3 rounded-[12px]"
      style={{ padding: '10px 4px', minHeight: 56 }}
    >
      <div
        className="flex items-center justify-center rounded-[10px] flex-shrink-0"
        style={{ width: 36, height: 36, background: iconBg, color: iconColor }}
      >
        <Icon size={18} strokeWidth={1.6} />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[14px] text-[var(--fg-1)] font-medium truncate">{label}</span>
        <span className="k-money text-[12px] text-[var(--fg-3)]">{payment.when}</span>
      </div>
      <span
        className="k-money text-[14px] font-medium whitespace-nowrap"
        style={{
          color: amountColor,
          filter: valuesHidden ? 'blur(6px)' : 'none',
          transition: 'filter 200ms ease-out',
          userSelect: valuesHidden ? 'none' : 'auto',
        }}
      >
        {isOut ? '− ' : '+ '}
        {payment.amountBRL}
      </span>
    </div>
  );
}

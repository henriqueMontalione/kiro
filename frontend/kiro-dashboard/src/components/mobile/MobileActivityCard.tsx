import { ChevronRight, ShoppingBag, Zap, ArrowLeftRight } from 'lucide-react';
import { Card } from '../Card';
import { RECENT_TX } from '@/lib/mocks';
import type { Transaction } from '@/types';

interface MobileActivityCardProps {
  onSeeAll: () => void;
  /** Limit the number of rows rendered. Keeps the home screen scannable. */
  limit?: number;
}

/**
 * Condensed "Atividade Recente" list for the mobile home. Each row shows
 * a circled icon, label + when, and the signed amount in mono. Order ids
 * and status tags are intentionally hidden here — they live on the full
 * Transações screen reachable from "Ver todas".
 */
export function MobileActivityCard({ onSeeAll, limit = 3 }: MobileActivityCardProps) {
  const rows = RECENT_TX.slice(0, limit);

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

      <ul className="flex flex-col gap-1 list-none m-0 p-0">
        {rows.map((tx) => (
          <li key={tx.id}>
            <ActivityRow tx={tx} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ActivityRow({ tx }: { tx: Transaction }) {
  const isRefund = tx.status === 'danger';
  const isPending = tx.status === 'pending';
  const isGreen = tx.accent === 'green';
  const Icon = isRefund ? ArrowLeftRight : isPending ? Zap : ShoppingBag;

  const iconBg = isRefund
    ? 'rgba(255,77,109,0.10)'
    : isGreen
      ? 'rgba(0,255,135,0.10)'
      : 'rgba(123,44,191,0.16)';
  const iconColor = isRefund ? '#FF4D6D' : isGreen ? 'var(--kiro-green)' : '#C99EFA';
  const amountColor = isRefund
    ? '#FF4D6D'
    : tx.amount.trim().startsWith('+')
      ? 'var(--kiro-green)'
      : 'var(--fg-1)';

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
        <span className="text-[14px] text-[var(--fg-1)] font-medium truncate">{tx.label}</span>
        <span className="k-money text-[12px] text-[var(--fg-3)]">{tx.when}</span>
      </div>
      <span
        className="k-money text-[14px] font-medium whitespace-nowrap"
        style={{ color: amountColor }}
      >
        {tx.amount.trim().startsWith('-') ? tx.amount : `+ ${tx.amount}`}
      </span>
    </div>
  );
}

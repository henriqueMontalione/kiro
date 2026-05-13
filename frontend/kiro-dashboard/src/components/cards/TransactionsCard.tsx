import { ChevronRight, ShoppingBag, ShoppingCart, ArrowLeftRight } from 'lucide-react';
import { Card, CardEyebrow } from '../Card';
import { StatusTag, type Status } from '../StatusTag';
import { RECENT_TX } from '@/lib/mocks';
import type { Transaction } from '@/types';

interface TransactionsCardProps {
  onSeeAll: () => void;
}

/** "Transações Recentes" — top 5 rows from the mocks. */
export function TransactionsCard({ onSeeAll }: TransactionsCardProps) {
  return (
    <Card className="!p-[18px]">
      <CardEyebrow
        action={
          <button
            type="button"
            onClick={onSeeAll}
            className="inline-flex items-center gap-1 bg-transparent border-none text-[var(--kiro-green)] font-display text-[12px] font-medium cursor-pointer"
          >
            Ver todas <ChevronRight size={12} strokeWidth={1.6} />
          </button>
        }
      >
        Transações Recentes
      </CardEyebrow>

      <div className="flex flex-col gap-[2px]">
        {RECENT_TX.map((tx) => (
          <TxRow key={tx.id} tx={tx} />
        ))}
      </div>
    </Card>
  );
}

/** Single transaction row — same grid is reused on the Transações page. */
export function TxRow({ tx }: { tx: Transaction }) {
  const isRefund = tx.status === 'danger';
  const isGreen = tx.accent === 'green';
  const Icon = isRefund ? ArrowLeftRight : isGreen ? ShoppingBag : ShoppingCart;

  const statusMap: Record<Transaction['status'], Status> = {
    success: 'success',
    pending: 'warning',
    danger: 'danger',
  };
  const statusLabel: Record<Transaction['status'], string> = {
    success: 'Concluído',
    pending: 'Pendente',
    danger: 'Reembolsado',
  };

  return (
    <div
      className="grid items-center cursor-pointer rounded-[12px] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-white/[0.03]"
      style={{
        gridTemplateColumns: '36px 1fr auto 110px 100px',
        gap: 16,
        padding: '14px 12px',
      }}
    >
      <div
        className="flex items-center justify-center rounded-[10px]"
        style={{
          width: 36,
          height: 36,
          background: isRefund
            ? 'rgba(255,77,109,0.10)'
            : isGreen
              ? 'rgba(0,255,135,0.10)'
              : 'rgba(123,44,191,0.16)',
          color: isRefund ? '#FF4D6D' : isGreen ? 'var(--kiro-green)' : '#C99EFA',
        }}
      >
        <Icon size={18} strokeWidth={1.6} />
      </div>
      <div>
        <div className="text-[14px] text-[var(--fg-1)] font-medium">{tx.label}</div>
        <div className="k-money text-[11px] text-[var(--fg-3)] mt-[2px]">Pedido #{tx.id}</div>
      </div>
      <div
        className="k-money text-[14px] text-right"
        style={{ color: isRefund ? '#FF4D6D' : 'var(--fg-1)' }}
      >
        {tx.amount}
      </div>
      <div>
        <StatusTag status={statusMap[tx.status]}>{statusLabel[tx.status]}</StatusTag>
      </div>
      <div className="k-money text-[11px] text-[var(--fg-3)] text-right">{tx.when}</div>
    </div>
  );
}

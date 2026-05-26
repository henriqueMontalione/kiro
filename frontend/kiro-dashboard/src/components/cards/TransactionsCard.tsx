import { useEffect } from 'react';
import { ChevronRight, ShoppingBag, ShoppingCart, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { Card, CardEyebrow } from '../Card';
import { StatusTag, type Status } from '../StatusTag';
import type { Transaction } from '@/types';
import { useWallet } from '@/context/WalletContext';
import { useDashboard } from '@/context/DashboardContext';
import { useTransactions } from '@/context/TransactionsContext';
import type { WalletPayment } from '@/lib/stellar';

interface TransactionsCardProps {
  onSeeAll: () => void;
}

/** "Transações Recentes" — most recent TESOURO movements recorded by the backend. */
export function TransactionsCard({ onSeeAll }: TransactionsCardProps) {
  const { isConnected } = useWallet();
  const { valuesHidden, refreshTick } = useDashboard();
  const { payments: allPayments, refresh } = useTransactions();
  const payments = isConnected ? allPayments.slice(0, 5) : null;

  useEffect(() => {
    if (refreshTick > 0) refresh();
  }, [refreshTick, refresh]);

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
        {!isConnected && (
          <EmptyState message="Conecte sua carteira para ver suas movimentações." />
        )}
        {isConnected && payments === null && <SkeletonRows count={3} />}
        {isConnected && payments && payments.length === 0 && (
          <EmptyState message="Nenhuma movimentação registrada ainda." />
        )}
        {payments?.map((p) => (
          <WalletPaymentRow key={p.id} payment={p} valuesHidden={valuesHidden} />
        ))}
      </div>
    </Card>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="grid items-center rounded-[12px]"
          style={{
            gridTemplateColumns: '36px 1fr auto 110px 100px',
            gap: 16,
            padding: '14px 12px',
          }}
        >
          <div
            className="rounded-[10px] animate-pulse"
            style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.04)' }}
          />
          <div
            className="rounded animate-pulse"
            style={{ height: 14, width: '60%', background: 'rgba(255,255,255,0.04)' }}
          />
          <div
            className="rounded animate-pulse"
            style={{ height: 14, width: 90, background: 'rgba(255,255,255,0.04)' }}
          />
          <div
            className="rounded animate-pulse"
            style={{ height: 22, width: 90, background: 'rgba(255,255,255,0.04)' }}
          />
          <div
            className="rounded animate-pulse"
            style={{ height: 12, width: 80, background: 'rgba(255,255,255,0.04)' }}
          />
        </div>
      ))}
    </>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="text-center text-[var(--fg-3)] text-[13px]"
      style={{ padding: '32px 12px' }}
    >
      {message}
    </div>
  );
}

function WalletPaymentRow({ payment, valuesHidden }: { payment: WalletPayment; valuesHidden: boolean }) {
  const isOut = payment.direction === 'out';
  const Icon = isOut ? ArrowUpRight : ShoppingBag;
  const label = isOut ? 'Saque via PIX' : 'Pagamento recebido';

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
          background: isOut ? 'rgba(123,44,191,0.16)' : 'rgba(0,255,135,0.10)',
          color: isOut ? '#C99EFA' : 'var(--kiro-green)',
        }}
      >
        <Icon size={18} strokeWidth={1.6} />
      </div>
      <div className="text-[14px] text-[var(--fg-1)] font-medium">{label}</div>
      <div
        className="k-money text-[14px] text-right"
        style={{
          color: isOut ? '#FF4D6D' : 'var(--fg-1)',
          filter: valuesHidden ? 'blur(6px)' : 'none',
          transition: 'filter 200ms ease-out',
          userSelect: valuesHidden ? 'none' : 'auto',
        }}
      >
        {isOut ? '− ' : '+ '}
        {payment.amountBRL}
      </div>
      <div>
        <StatusTag status="success">Concluído</StatusTag>
      </div>
      <div className="k-money text-[11px] text-[var(--fg-3)] text-right">{payment.when}</div>
    </div>
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

import { useMemo } from 'react';
import { Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusTag } from '@/components/StatusTag';
import { useWallet } from '@/context/WalletContext';
import { useTransactions } from '@/context/TransactionsContext';
import { formatBRL, type WalletPayment } from '@/lib/stellar';

interface RecebimentosProps {
  onReceive: () => void;
}

/** Lists every TESOURO payment that has arrived in the connected wallet. */
export default function Recebimentos({ onReceive }: RecebimentosProps) {
  const { isConnected } = useWallet();
  const { payments: allPayments } = useTransactions();
  const payments: WalletPayment[] | null = isConnected
    ? allPayments.filter((p) => p.direction === 'in')
    : null;

  const totalLabel = useMemo(() => {
    if (!payments || payments.length === 0) return null;
    const sum = payments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
    return formatBRL(sum.toFixed(7));
  }, [payments]);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-between items-end flex-wrap gap-[14px]">
        <div>
          <h1 className="k-h1">Recebimentos</h1>
          <div className="text-[13px] text-[var(--fg-3)] mt-1">
            Pagamentos recebidos na sua conta Kiro.
          </div>
        </div>
        <Button variant="primary" icon={Plus} onClick={onReceive}>
          Novo recebimento
        </Button>
      </div>

      {totalLabel && (
        <Card glass={false} className="!p-[18px]">
          <div className="text-[11px] uppercase text-[var(--fg-3)]" style={{ letterSpacing: '0.04em' }}>
            Total recebido
          </div>
          <div className="k-money font-medium mt-1" style={{ fontSize: 28, color: 'var(--kiro-green)' }}>
            {totalLabel}
          </div>
          <div className="text-[12px] text-[var(--fg-3)] mt-1">
            {payments!.length === 1 ? '1 pagamento' : `${payments!.length} pagamentos`}
          </div>
        </Card>
      )}

      <Card glass={false} className="!p-[18px] flex flex-col gap-[14px]">
        <div
          className="grid border-b border-[var(--stroke-1)] font-display text-[11px] text-[var(--fg-3)] uppercase"
          style={{
            gridTemplateColumns: '36px 1fr auto 110px 110px',
            gap: 16,
            padding: '8px 12px',
            letterSpacing: '0.10em',
          }}
        >
          <div></div>
          <div>Descrição</div>
          <div className="text-right">Valor</div>
          <div>Status</div>
          <div className="text-right">Data</div>
        </div>

        {!isConnected && (
          <EmptyState message="Entre na sua conta para ver seus recebimentos." />
        )}
        {isConnected && payments === null && <SkeletonList />}
        {isConnected && payments && payments.length === 0 && (
          <EmptyState message="Nenhum pagamento recebido ainda." />
        )}
        {payments && payments.length > 0 && (
          <div className="flex flex-col gap-[2px]">
            {payments.map((p) => (
              <ReceivedRow key={p.id} payment={p} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ReceivedRow({ payment }: { payment: WalletPayment }) {
  return (
    <div
      className="grid items-center cursor-pointer rounded-[12px] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-white/[0.03]"
      style={{
        gridTemplateColumns: '36px 1fr auto 110px 110px',
        gap: 16,
        padding: '14px 12px',
      }}
    >
      <div
        className="flex items-center justify-center rounded-[10px]"
        style={{
          width: 36,
          height: 36,
          background: 'rgba(0,255,135,0.10)',
          color: 'var(--kiro-green)',
        }}
      >
        <ShoppingBag size={18} strokeWidth={1.6} />
      </div>
      <div className="text-[14px] text-[var(--fg-1)] font-medium">Pagamento recebido</div>
      <div className="k-money text-[14px] text-right" style={{ color: 'var(--kiro-green)' }}>
        + {payment.amountBRL}
      </div>
      <div>
        <StatusTag status="success">Concluído</StatusTag>
      </div>
      <div className="k-money text-[11px] text-[var(--fg-3)] text-right">{payment.when}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="text-center text-[var(--fg-3)] text-[13px]"
      style={{ padding: 60 }}
    >
      {message}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-[2px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid items-center rounded-[12px]"
          style={{
            gridTemplateColumns: '36px 1fr auto 110px 110px',
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
    </div>
  );
}

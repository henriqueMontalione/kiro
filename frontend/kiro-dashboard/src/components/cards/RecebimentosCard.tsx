import { useEffect, useMemo } from 'react';
import { Link2, ChevronRight } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardEyebrow } from '../Card';
import { useWallet } from '@/context/WalletContext';
import { useDashboard } from '@/context/DashboardContext';
import { useTransactions } from '@/context/TransactionsContext';
import { formatBRL, type WalletPayment } from '@/lib/stellar';

function isSameDay(iso: string, ref: Date): boolean {
  return new Date(iso).toDateString() === ref.toDateString();
}

/**
 * "Recebimentos hoje" — sum of TESOURO arriving in the wallet today,
 * plus an hourly bar chart of those arrivals.
 */
export function RecebimentosCard() {
  const { isConnected } = useWallet();
  const { valuesHidden, refreshTick } = useDashboard();
  const { payments: allPayments, refresh } = useTransactions();
  const payments: WalletPayment[] | null = isConnected ? allPayments : null;

  useEffect(() => {
    if (refreshTick > 0) refresh();
  }, [refreshTick, refresh]);

  const { totalLabel, countLabel, hourly } = useMemo(() => {
    const today = new Date();
    const incomingToday = (payments ?? []).filter(
      (p) => p.direction === 'in' && isSameDay(p.createdAt, today),
    );
    const totalCentavos = incomingToday.reduce((acc, p) => acc + p.brlCentavos, 0);
    const buckets = Array<number>(24).fill(0);
    for (const p of incomingToday) {
      const hour = new Date(p.createdAt).getHours();
      buckets[hour] += p.brlCentavos;
    }

    const showLoading = isConnected && payments === null;
    const count = incomingToday.length;
    return {
      totalLabel: showLoading ? '—' : formatBRL((totalCentavos / 100).toString()),
      countLabel: showLoading
        ? ' '
        : count === 1
          ? '1 pagamento hoje'
          : `${count} pagamentos hoje`,
      hourly: buckets,
    };
  }, [payments, isConnected]);

  const data = hourly.map((v, i) => ({
    hour: i,
    value: v,
    /** Fade the night-time hours (00–06 and 20–23). */
    opacity: i < 6 || i > 19 ? 0.35 : 0.9,
  }));

  return (
    <Card>
      <CardEyebrow info>Recebimentos hoje</CardEyebrow>

      <div
        className="k-money font-medium"
        style={{
          fontSize: 30,
          color: 'var(--kiro-green)',
          filter: valuesHidden ? 'blur(10px)' : 'none',
          transition: 'filter 200ms ease-out',
          userSelect: valuesHidden ? 'none' : 'auto',
        }}
      >
        {totalLabel}
      </div>
      <div className="text-[12px] text-[var(--fg-3)] mt-1">{countLabel}</div>

      <div className="mt-[18px]" style={{ height: 80 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap={2}>
            <Bar dataKey="value" radius={[2, 2, 0, 0]} fill="var(--kiro-green)">
              {data.map((entry, idx) => (
                <Cell key={idx} fillOpacity={entry.opacity} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between k-money text-[10px] text-[var(--fg-3)] mt-2">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>

      <div
        className="mt-4 flex items-center gap-3 border rounded-[var(--radius-md)] cursor-pointer"
        style={{
          padding: '12px 14px',
          borderColor: 'var(--stroke-2)',
          background: 'rgba(0,255,135,0.04)',
        }}
      >
        <div
          className="flex items-center justify-center rounded-[8px]"
          style={{ width: 28, height: 28, background: 'rgba(0,255,135,0.12)' }}
        >
          <Link2 size={14} color="var(--kiro-green)" strokeWidth={1.6} />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-medium text-[var(--fg-1)]">Receba na hora via PIX</div>
          <div className="k-money text-[11px] text-[var(--fg-3)] mt-[2px]">
            Disponível 24/7, todos os dias
          </div>
        </div>
        <ChevronRight size={16} color="var(--fg-3)" strokeWidth={1.6} />
      </div>
    </Card>
  );
}

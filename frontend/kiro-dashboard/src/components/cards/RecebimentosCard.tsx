import { useEffect, useMemo, useState } from 'react';
import { Link2, ChevronRight } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardEyebrow } from '../Card';
import { useWallet } from '@/context/WalletContext';
import { fetchTesouroPayments, formatBRL, type WalletPayment } from '@/lib/stellar';

function isSameDay(iso: string, ref: Date): boolean {
  return new Date(iso).toDateString() === ref.toDateString();
}

/**
 * "Recebimentos hoje" — sum of TESOURO arriving in the wallet today,
 * plus an hourly bar chart of those arrivals.
 */
export function RecebimentosCard() {
  const { publicKey, balance, isConnected } = useWallet();
  // `null` = haven't fetched yet (so we can show "—" instead of "R$ 0,00").
  const [payments, setPayments] = useState<WalletPayment[] | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setPayments(null);
      return;
    }
    let cancelled = false;
    // Pull a generous slice so we can filter client-side for today's window.
    // 100 is plenty for a merchant on a typical day.
    fetchTesouroPayments(publicKey, 100).then((p) => {
      if (!cancelled) setPayments(p);
    });
    return () => { cancelled = true; };
  }, [publicKey, balance]);

  const { totalLabel, countLabel, hourly } = useMemo(() => {
    const today = new Date();
    const incomingToday = (payments ?? []).filter(
      (p) => p.direction === 'in' && isSameDay(p.createdAt, today),
    );
    const total = incomingToday.reduce((acc, p) => acc + parseFloat(p.amount), 0);
    const buckets = Array<number>(24).fill(0);
    for (const p of incomingToday) {
      const hour = new Date(p.createdAt).getHours();
      buckets[hour] += parseFloat(p.amount);
    }

    const showLoading = isConnected && payments === null;
    const count = incomingToday.length;
    return {
      totalLabel: showLoading ? '—' : formatBRL(total.toFixed(7)),
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

      <div className="k-money font-medium" style={{ fontSize: 30, color: 'var(--kiro-green)' }}>
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

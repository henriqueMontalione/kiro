import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card } from '@/components/Card';
import { useWallet } from '@/context/WalletContext';
import { useTransactions } from '@/context/TransactionsContext';

interface DayEntry {
  label: string;
  received: number;
  withdrawn: number;
}

function buildChartData(payments: { direction: string; brlCentavos: number; createdAt: string }[]): DayEntry[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    const dayStr = d.toISOString().slice(0, 10);
    const label = d
      .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      .replace('.', '');
    const dayPayments = payments.filter((p) => p.createdAt.slice(0, 10) === dayStr);
    const received = dayPayments
      .filter((p) => p.direction === 'in')
      .reduce((sum, p) => sum + p.brlCentavos / 100, 0);
    const withdrawn = dayPayments
      .filter((p) => p.direction === 'out')
      .reduce((sum, p) => sum + p.brlCentavos / 100, 0);
    return { label, received, withdrawn };
  });
}

function fmtBRL(value: number) {
  return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ChartTooltipContent({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-[10px] border font-sans text-[12px]"
      style={{ background: 'var(--bg-2)', borderColor: 'var(--stroke-2)', padding: '10px 14px', minWidth: 140 }}
    >
      <div className="font-semibold text-[var(--fg-2)] mb-2">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="k-money" style={{ color: entry.color }}>{fmtBRL(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function MobileMais() {
  const { isConnected } = useWallet();
  const { payments } = useTransactions();

  const chartData = useMemo(
    () => buildChartData(isConnected ? payments : []),
    [payments, isConnected],
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPayments = isConnected ? payments.filter((p) => p.createdAt.slice(0, 10) === todayStr) : [];
  const todayIn = todayPayments.filter((p) => p.direction === 'in').reduce((s, p) => s + p.brlCentavos / 100, 0);
  const todayOut = todayPayments.filter((p) => p.direction === 'out').reduce((s, p) => s + p.brlCentavos / 100, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="k-h1">Movimentações</h1>
        <div className="text-[13px] text-[var(--fg-3)] mt-1">Últimos 7 dias</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-[11px] text-[var(--fg-3)] font-sans uppercase tracking-wider mb-1">Recebido hoje</div>
          <div className="k-money text-[18px] font-semibold" style={{ color: 'var(--kiro-green)' }}>
            {isConnected ? fmtBRL(todayIn) : '—'}
          </div>
        </Card>
        <Card>
          <div className="text-[11px] text-[var(--fg-3)] font-sans uppercase tracking-wider mb-1">Sacado hoje</div>
          <div className="k-money text-[18px] font-semibold" style={{ color: '#C99EFA' }}>
            {isConnected ? fmtBRL(todayOut) : '—'}
          </div>
        </Card>
      </div>

      <Card>
        <div className="font-display text-[14px] font-semibold text-[var(--fg-1)] mb-4">
          Volume diário
        </div>

        {!isConnected && (
          <div className="text-center text-[var(--fg-3)] text-[13px]" style={{ padding: '40px 0' }}>
            Entre na sua conta para ver suas movimentações.
          </div>
        )}

        {isConnected && (
          <>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--fg-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    content={<ChartTooltipContent />}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="received" name="Recebido" fill="#00FF87" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="withdrawn" name="Sacado" fill="#C99EFA" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-4 mt-3">
              <span className="inline-flex items-center gap-[6px] font-sans text-[11px] text-[var(--fg-3)]">
                <span className="rounded-full" style={{ width: 8, height: 8, background: '#00FF87' }} />
                Recebido
              </span>
              <span className="inline-flex items-center gap-[6px] font-sans text-[11px] text-[var(--fg-3)]">
                <span className="rounded-full" style={{ width: 8, height: 8, background: '#C99EFA' }} />
                Sacado
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

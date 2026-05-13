import { Link2, ChevronRight } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardEyebrow } from '../Card';
import { RECEBIMENTOS_TODAY } from '@/lib/mocks';

/** "Recebimentos hoje" — hourly bar chart + CTA to share PIX. */
export function RecebimentosCard() {
  const data = RECEBIMENTOS_TODAY.hourly.map((v, i) => ({
    hour: i,
    value: v,
    /** Fade the night-time hours (00–06 and 20–23). */
    opacity: i < 6 || i > 19 ? 0.35 : 0.9,
  }));

  return (
    <Card>
      <CardEyebrow info>Recebimentos hoje</CardEyebrow>

      <div className="k-money font-medium" style={{ fontSize: 30, color: 'var(--kiro-green)' }}>
        {RECEBIMENTOS_TODAY.total}
      </div>
      <div className="text-[12px] text-[var(--fg-3)] mt-1">{RECEBIMENTOS_TODAY.count}</div>

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

import { useState } from 'react';
import { TrendingUp, TrendingDown, Zap, Info } from 'lucide-react';
import { Card } from './Card';
import { YieldInfoModal } from './YieldInfoModal';
import { useInvestment } from '@/context/InvestmentContext';
import { useWallet } from '@/context/WalletContext';

function fmtBRL(centavos: number): string {
  const v = Math.abs(centavos) / 100;
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(p: number): string {
  return p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

/**
 * Combines realized gains from past withdrawals with the unrealized
 * mark-to-market on remaining TESOURO at the live quote.
 *
 * Responsive: compact on phone, larger on tablet/desktop. Same component is
 * used in both /resumo (desktop grid cell) and /mais (mobile list).
 */
export function YieldCard() {
  const { isConnected } = useWallet();
  const { yieldCentavos, yieldPercent, currentValueCentavos } = useInvestment();
  const [infoOpen, setInfoOpen] = useState(false);

  const ready = isConnected && yieldCentavos != null;
  const positive = ready && yieldCentavos! >= 0;
  const color = !ready
    ? 'var(--fg-3)'
    : positive
      ? 'var(--kiro-green)'
      : '#FF8FA3';

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-[11px] text-[var(--fg-3)] font-sans uppercase tracking-wider">
            Rendimento acumulado
          </div>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="flex items-center justify-center cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-3)' }}
            aria-label="Como funciona o rendimento"
          >
            <Info size={14} strokeWidth={1.8} />
          </button>
        </div>

        <div
          className="k-money font-medium md:font-semibold"
          style={{ color, fontSize: 'clamp(22px, 5vw, 36px)', letterSpacing: '-0.01em' }}
        >
          {ready ? (positive ? '+' : '−') + fmtBRL(yieldCentavos!) : '—'}
        </div>

        <div className="flex items-center gap-2 mt-1 text-[12px] text-[var(--fg-3)] flex-wrap">
          {ready && yieldPercent != null && (
            <span className="inline-flex items-center gap-1" style={{ color }}>
              {positive
                ? <TrendingUp size={12} strokeWidth={2} />
                : <TrendingDown size={12} strokeWidth={2} />}
              {(positive ? '+' : '−') + fmtPct(Math.abs(yieldPercent))}
            </span>
          )}
          {ready && currentValueCentavos != null && (
            <span>Valor atual {fmtBRL(currentValueCentavos)}</span>
          )}
        </div>

        <div
          className="mt-4 md:mt-5 flex items-center gap-3 border rounded-[var(--radius-md)]"
          style={{
            padding: '12px 14px',
            borderColor: 'var(--stroke-2)',
            background: 'rgba(123,44,191,0.06)',
          }}
        >
          <div
            className="flex items-center justify-center rounded-[8px] flex-shrink-0"
            style={{ width: 28, height: 28, background: 'rgba(123,44,191,0.20)' }}
          >
            <Zap size={14} color="#C99EFA" strokeWidth={1.6} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-[var(--fg-1)]">
              Seu saldo rende automaticamente
            </div>
            <div className="k-money text-[11px] text-[var(--fg-3)] mt-[2px]">
              100% do CDI para contas Kiro
            </div>
          </div>
        </div>
      </Card>

      <YieldInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}

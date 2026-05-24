import { Diamond, ChevronRight, Eye, EyeOff, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardEyebrow } from '../Card';
import { Button } from '../Button';
import { BALANCE } from '@/lib/mocks';
import { useWallet } from '@/context/WalletContext';
import { useDashboard } from '@/context/DashboardContext';
import { useQuote } from '@/context/QuoteContext';

interface BalanceCardProps {
  onReceive: () => void;
}

export function BalanceCard({ onReceive }: BalanceCardProps) {
  const { isConnected, balance } = useWallet();
  const { valuesHidden, toggleValuesHidden, refresh, isRefreshing } = useDashboard();
  const { formatTesouroAsBRL, brlPerTesouro } = useQuote();

  const tesouroAmount = isConnected && balance !== null ? parseFloat(balance) : null;
  const rateReady = brlPerTesouro !== null;
  const displayBRL =
    tesouroAmount !== null && rateReady
      ? formatTesouroAsBRL(tesouroAmount)
      : null;

  const isBlurred = !isConnected || valuesHidden;

  return (
    <Card className="min-h-[290px]">
      {/* Watermark "K" — faint isotype tucked behind the number */}
      <span
        aria-hidden="true"
        className="absolute pointer-events-none select-none font-display font-bold"
        style={{
          right: -20,
          top: -38,
          fontSize: 320,
          lineHeight: 0.8,
          color: 'rgba(255,255,255,0.025)',
        }}
      >
        K
      </span>

      <CardEyebrow info>
        Saldo Disponível
        {isConnected && (
          <>
            <button
              type="button"
              onClick={toggleValuesHidden}
              title={valuesHidden ? 'Mostrar' : 'Ocultar'}
              className="bg-transparent border-none text-[var(--fg-3)] cursor-pointer p-0 ml-[6px] inline-flex hover:text-[var(--fg-1)] transition-colors"
            >
              {valuesHidden ? <EyeOff size={15} strokeWidth={1.6} /> : <Eye size={15} strokeWidth={1.6} />}
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              title="Atualizar dados"
              className="bg-transparent border-none text-[var(--fg-3)] cursor-pointer p-0 ml-[6px] inline-flex hover:text-[var(--fg-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                size={14}
                strokeWidth={1.8}
                className={isRefreshing ? 'animate-spin' : ''}
              />
            </button>
          </>
        )}
      </CardEyebrow>

      {/* Primary: BRL equivalent — spinner while rate is loading */}
      {displayBRL !== null ? (
        <div
          className="k-money font-medium"
          style={{
            fontSize: 64,
            lineHeight: 1.05,
            color: 'var(--kiro-green)',
            textShadow: '0 0 30px rgba(0,255,135,0.30)',
            letterSpacing: '-0.01em',
            filter: isBlurred ? 'blur(14px)' : 'none',
            transition: 'filter 200ms ease-out',
            userSelect: isBlurred ? 'none' : 'auto',
          }}
        >
          {displayBRL}
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-3" style={{ height: 67 }}>
          {isConnected
            ? <Loader2 size={22} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--fg-3)' }} />
            : <span className="k-money font-medium" style={{ fontSize: 64, lineHeight: 1.05, color: 'var(--fg-3)' }}>—</span>
          }
        </div>
      )}

      <div className="mt-[14px] flex items-center gap-2 font-sans text-[12px] text-[var(--fg-3)]">
        <span
          className="rounded-full bg-[var(--kiro-green)]"
          style={{ width: 8, height: 8, boxShadow: '0 0 8px rgba(0,255,135,0.7)' }}
        />
        {BALANCE.updatedLabel}
      </div>

      <div className="mt-7">
        <Button
          variant="primary"
          size="lg"
          icon={Diamond}
          iconRight={ChevronRight}
          onClick={onReceive}
        >
          Receber via PIX agora
        </Button>
      </div>
    </Card>
  );
}

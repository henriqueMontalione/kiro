import { useState } from 'react';
import { Diamond, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Card, CardEyebrow } from '../Card';
import { Button } from '../Button';
import { BALANCE } from '@/lib/mocks';
import { useWallet } from '@/context/WalletContext';
import { formatBRL } from '@/lib/stellar';

interface BalanceCardProps {
  onReceive: () => void;
}

export function BalanceCard({ onReceive }: BalanceCardProps) {
  const [hidden, setHidden] = useState(false);
  const { isConnected, balance } = useWallet();

  const displayBalance = isConnected && balance !== null ? formatBRL(balance) : 'R$ 0,00';
  const isBlurred = !isConnected || hidden;

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
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            title={hidden ? 'Mostrar' : 'Ocultar'}
            className="bg-transparent border-none text-[var(--fg-3)] cursor-pointer p-0 ml-[6px] inline-flex"
          >
            {hidden ? <EyeOff size={15} strokeWidth={1.6} /> : <Eye size={15} strokeWidth={1.6} />}
          </button>
        )}
      </CardEyebrow>

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
        {displayBalance}
      </div>

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

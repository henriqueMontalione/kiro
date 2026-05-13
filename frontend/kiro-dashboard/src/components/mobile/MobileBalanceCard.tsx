import { useState } from 'react';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { BALANCE, YIELD_APY_LABEL } from '@/lib/mocks';

interface MobileBalanceCardProps {
  onReceive: () => void;
}

/**
 * Mobile saldo card. Single full-width column, with the secondary
 * "Sacar PIX" CTA below the number. The primary "Cobrar" surface from
 * the reference image is intentionally omitted — withdrawal is the only
 * action shipped on the mobile home for now.
 */
export function MobileBalanceCard({ onReceive }: MobileBalanceCardProps) {
  const [hidden, setHidden] = useState(false);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="k-eyebrow">Saldo Disponível</span>
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
          aria-pressed={hidden}
          className="inline-flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-white/[0.04] transition-colors"
          style={{ width: 36, height: 36 }}
        >
          {hidden ? <EyeOff size={18} strokeWidth={1.6} /> : <Eye size={18} strokeWidth={1.6} />}
        </button>
      </div>

      <div
        className="k-money font-medium"
        style={{
          fontSize: 38,
          lineHeight: 1.1,
          color: 'var(--kiro-green)',
          textShadow: '0 0 24px rgba(0,255,135,0.28)',
          letterSpacing: '-0.01em',
          filter: hidden ? 'blur(12px)' : 'none',
          transition: 'filter 200ms ease-out',
        }}
      >
        {BALANCE.available}
      </div>

      <div
        className="inline-flex items-center gap-[6px] mt-3 rounded-full font-sans text-[12px] text-[var(--kiro-green)]"
        style={{
          padding: '5px 10px',
          background: 'rgba(0,255,135,0.10)',
          border: '1px solid rgba(0,255,135,0.22)',
        }}
      >
        <Sparkles size={13} strokeWidth={1.8} />
        Rendendo {YIELD_APY_LABEL}
      </div>

      <div className="mt-5">
        <Button variant="secondary" size="lg" onClick={onReceive} className="w-full justify-center">
          Sacar PIX
        </Button>
      </div>
    </Card>
  );
}

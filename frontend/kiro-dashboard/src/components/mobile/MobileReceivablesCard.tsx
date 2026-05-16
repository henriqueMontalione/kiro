import { Calendar } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { A_RECEBER } from '@/lib/mocks';
import { useDashboard } from '@/context/DashboardContext';

interface MobileReceivablesCardProps {
  onAnticipate?: () => void;
}

/**
 * "A Receber" card on mobile home. Mirrors the desktop receivables
 * info but compressed to one row + a single full-width CTA.
 */
export function MobileReceivablesCard({ onAnticipate }: MobileReceivablesCardProps) {
  const { valuesHidden } = useDashboard();
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="k-eyebrow">A Receber ({A_RECEBER.window})</span>
          <div
            className="k-money font-medium"
            style={{
              fontSize: 32,
              lineHeight: 1.1,
              color: 'var(--fg-1)',
              letterSpacing: '-0.01em',
              filter: valuesHidden ? 'blur(12px)' : 'none',
              transition: 'filter 200ms ease-out',
              userSelect: valuesHidden ? 'none' : 'auto',
            }}
          >
            {A_RECEBER.total}
          </div>
        </div>
        <div
          className="inline-flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: 40,
            height: 40,
            background: 'rgba(0,255,135,0.10)',
            border: '1px solid rgba(0,255,135,0.22)',
            color: 'var(--kiro-green)',
          }}
          aria-hidden="true"
        >
          <Calendar size={18} strokeWidth={1.6} />
        </div>
      </div>

      <div className="mt-5">
        <Button variant="primary" size="lg" onClick={onAnticipate} className="w-full justify-center">
          Antecipar para Hoje
        </Button>
      </div>
    </Card>
  );
}

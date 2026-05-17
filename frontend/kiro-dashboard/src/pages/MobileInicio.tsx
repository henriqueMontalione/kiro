import { useNavigate } from 'react-router-dom';
import { MobileBalanceCard } from '@/components/mobile/MobileBalanceCard';
import { MobileReceivablesCard } from '@/components/mobile/MobileReceivablesCard';
import { MobileActivityCard } from '@/components/mobile/MobileActivityCard';

interface MobileInicioProps {
  onReceive: () => void;
}

/**
 * Mobile home screen — a single scrollable column. Order mirrors the
 * reference design: saldo first (with sacar action), then upcoming
 * receivables (with "Antecipar" action), then a short activity peek.
 */
export default function MobileInicio({ onReceive }: MobileInicioProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <MobileBalanceCard onReceive={onReceive} />
      <MobileReceivablesCard />
      <MobileActivityCard onSeeAll={() => navigate('/transacoes')} />
    </div>
  );
}

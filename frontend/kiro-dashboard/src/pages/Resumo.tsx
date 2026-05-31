import { useNavigate } from 'react-router-dom';
import { BalanceCard } from '@/components/cards/BalanceCard';
import { YieldCard } from '@/components/YieldCard';
import { TransactionsCard } from '@/components/cards/TransactionsCard';
import { RecebimentosCard } from '@/components/cards/RecebimentosCard';
import MobileInicio from '@/pages/MobileInicio';

interface ResumoProps {
  onReceive: () => void;
}

/**
 * Default landing screen.
 *
 * Below md (mobile): renders the single-column MobileInicio.
 * At md and above (tablet/desktop): renders the two-column dashboard
 * grid — balance + yield on top, transactions + receivables on bottom.
 */
export default function Resumo({ onReceive }: ResumoProps) {
  const navigate = useNavigate();
  return (
    <>
      <div className="md:hidden">
        <MobileInicio onReceive={onReceive} />
      </div>

      <div
        className="hidden md:grid gap-5"
        style={{ gridTemplateColumns: '1.4fr 1fr' }}
      >
        <BalanceCard onReceive={onReceive} />
        <YieldCard />
        <TransactionsCard onSeeAll={() => navigate('/transacoes')} />
        <RecebimentosCard />
      </div>
    </>
  );
}

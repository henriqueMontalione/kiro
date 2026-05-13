import { useNavigate } from 'react-router-dom';
import { BalanceCard } from '@/components/cards/BalanceCard';
import { YieldCard } from '@/components/cards/YieldCard';
import { TransactionsCard } from '@/components/cards/TransactionsCard';
import { RecebimentosCard } from '@/components/cards/RecebimentosCard';

interface ResumoProps {
  onReceive: () => void;
}

/**
 * Default landing screen — the canonical Kiro merchant dashboard.
 * Two-column grid: balance + yield on top, transactions + today on bottom.
 */
export default function Resumo({ onReceive }: ResumoProps) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
      <BalanceCard onReceive={onReceive} />
      <YieldCard />
      <TransactionsCard onSeeAll={() => navigate('/transacoes')} />
      <RecebimentosCard />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Download, Filter, Plus, Search } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChip } from '@/components/FilterChip';
import { TxRow } from '@/components/cards/TransactionsCard';
import { ALL_TX } from '@/lib/mocks';

type FilterKey = 'todos' | 'concluido' | 'pendente' | 'reembolso';

/** Full filterable transactions list. */
export default function Transacoes() {
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [q, setQ] = useState('');

  const filtered = useMemo(
    () =>
      ALL_TX.filter((tx) => {
        if (filter === 'pendente' && tx.status !== 'pending') return false;
        if (filter === 'concluido' && tx.status !== 'success') return false;
        if (filter === 'reembolso' && tx.status !== 'danger') return false;
        if (q && !(tx.id.includes(q) || tx.label.toLowerCase().includes(q.toLowerCase()))) {
          return false;
        }
        return true;
      }),
    [filter, q],
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-end justify-between flex-wrap gap-[14px]">
        <div>
          <h1 className="k-h1">Transações</h1>
          <div className="text-[13px] text-[var(--fg-3)] mt-1">
            Todas as movimentações da sua conta KIRO.
          </div>
        </div>
        <div className="flex gap-[10px]">
          <Button variant="secondary" size="sm" icon={Filter}>
            Filtros
          </Button>
          <Button variant="secondary" size="sm" icon={Download}>
            Exportar CSV
          </Button>
          <Button variant="primary" size="sm" icon={Plus}>
            Novo recebimento
          </Button>
        </div>
      </div>

      <Card glass={false} className="!p-[18px] flex flex-col gap-[14px]">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[280px] max-w-[380px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-3)]">
              <Search size={16} strokeWidth={1.6} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por pedido, cliente ou valor"
              className="w-full border outline-none rounded-[var(--radius-md)] font-sans text-[13px]"
              style={{
                padding: '10px 12px 10px 38px',
                background: 'var(--bg-3)',
                borderColor: 'var(--stroke-3)',
                color: 'var(--fg-1)',
              }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <FilterChip active={filter === 'todos'} onClick={() => setFilter('todos')}>
              Todos
            </FilterChip>
            <FilterChip active={filter === 'concluido'} onClick={() => setFilter('concluido')}>
              Concluídos
            </FilterChip>
            <FilterChip active={filter === 'pendente'} onClick={() => setFilter('pendente')}>
              Pendentes
            </FilterChip>
            <FilterChip active={filter === 'reembolso'} onClick={() => setFilter('reembolso')}>
              Reembolsos
            </FilterChip>
          </div>
        </div>

        <div
          className="grid border-b border-[var(--stroke-1)] font-display text-[11px] text-[var(--fg-3)] uppercase"
          style={{
            gridTemplateColumns: '36px 1fr auto 110px 100px',
            gap: 16,
            padding: '8px 12px',
            letterSpacing: '0.10em',
          }}
        >
          <div></div>
          <div>Descrição</div>
          <div className="text-right">Valor</div>
          <div>Status</div>
          <div className="text-right">Data</div>
        </div>

        <div className="flex flex-col gap-[2px]">
          {filtered.length === 0 && (
            <div
              className="text-center text-[var(--fg-3)] text-[13px]"
              style={{ padding: 60 }}
            >
              Nenhuma transação encontrada.
            </div>
          )}
          {filtered.map((tx) => (
            <TxRow key={tx.id} tx={tx} />
          ))}
        </div>
      </Card>
    </div>
  );
}

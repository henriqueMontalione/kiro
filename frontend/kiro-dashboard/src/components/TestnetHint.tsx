import { Info } from 'lucide-react';

interface TestnetHintProps {
  onSkip: () => void;
  skipping: boolean;
}

export function TestnetHint({ onSkip, skipping }: TestnetHintProps) {
  return (
    <div
      className="flex items-start gap-2 rounded-[var(--radius-sm)] border"
      style={{
        padding: '10px 12px',
        background: 'rgba(255,181,71,0.06)',
        borderColor: 'rgba(255,181,71,0.30)',
      }}
    >
      <Info size={14} color="#FFB547" strokeWidth={1.7} className="mt-[2px] flex-shrink-0" />
      <div className="text-[12px] leading-snug">
        <p className="font-medium text-[var(--fg-1)] mb-[2px]">Modo Testnet</p>
        <p className="text-[var(--fg-2)]">
          Os códigos de SMS não chegam no celular — eles aparecem no helper laranja do
          Etherfuse. Se o helper estiver cortado, abra em nova janela.{' '}
          <button
            type="button"
            onClick={onSkip}
            disabled={skipping}
            className="bg-transparent border-none cursor-pointer p-0 underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: '#FFB547', font: 'inherit' }}
          >
            {skipping ? 'Aprovando...' : 'Clique aqui para pular a aprovação.'}
          </button>
        </p>
      </div>
    </div>
  );
}

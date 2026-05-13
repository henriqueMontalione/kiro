import { Crown, ChevronRight } from 'lucide-react';

/** Bottom-of-sidebar upgrade card. Purple gradient — never green. */
export function ProUpgradeCard() {
  return (
    <div
      className="border rounded-[var(--radius-md)] p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(0,255,135,0.08) 0%, rgba(123,44,191,0.20) 100%)',
        borderColor: 'rgba(123,44,191,0.40)',
        margin: '8px 6px 0',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex items-center justify-center rounded-[8px]"
          style={{ width: 26, height: 26, background: 'rgba(123,44,191,0.40)' }}
        >
          <Crown size={14} color="#E0C6FF" strokeWidth={1.6} />
        </div>
        <span
          className="font-display font-semibold text-[14px] text-[var(--fg-1)]"
          style={{ letterSpacing: '0.02em' }}
        >
          KIRO Pro
        </span>
      </div>
      <div className="text-[12px] text-[var(--fg-2)] leading-[1.45]">
        Mais controle, limites maiores e taxas reduzidas.
      </div>
      <button
        type="button"
        className="mt-3 w-full inline-flex items-center justify-between rounded-[10px] px-3 py-2 font-display text-[13px] font-medium text-white cursor-pointer"
        style={{
          background: 'rgba(123,44,191,0.35)',
          border: '1px solid rgba(123,44,191,0.55)',
        }}
      >
        Conhecer planos <ChevronRight size={14} strokeWidth={1.6} />
      </button>
    </div>
  );
}

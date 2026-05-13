import { Settings } from 'lucide-react';

/** Fallback for the sidebar links whose screens aren't built yet. */
export default function Placeholder({ name }: { name: string }) {
  return (
    <div
      className="text-center rounded-[var(--radius-lg)] border border-dashed border-[var(--stroke-3)]"
      style={{ padding: 80, background: 'rgba(255,255,255,0.02)' }}
    >
      <div
        className="inline-flex items-center justify-center rounded-[16px] mb-[18px]"
        style={{ width: 56, height: 56, background: 'rgba(123,44,191,0.18)' }}
      >
        <Settings size={24} color="#C99EFA" strokeWidth={1.6} />
      </div>
      <div className="k-h2">{name}</div>
      <div
        className="text-[var(--fg-3)] text-[13px] mt-[6px] mx-auto"
        style={{ maxWidth: 360 }}
      >
        Esta tela ainda não foi recriada no UI kit. Apenas{' '}
        <strong className="text-[var(--fg-2)]">Resumo</strong>,{' '}
        <strong className="text-[var(--fg-2)]">Transações</strong> e{' '}
        <strong className="text-[var(--fg-2)]">Recebimentos</strong> estão implementadas.
      </div>
    </div>
  );
}

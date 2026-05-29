import { createPortal } from 'react-dom';
import { X, Landmark } from 'lucide-react';

interface TesouroInfoModalProps {
  open: boolean;
  onClose: () => void;
}

export function TesouroInfoModal({ open, onClose }: TesouroInfoModalProps) {
  if (!open) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="O que é TESOURO"
      className="fixed inset-0 z-[130] flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className="relative w-full md:max-w-[440px] rounded-t-[24px] md:rounded-[24px] border border-[var(--stroke-2)]"
        style={{ background: 'var(--bg-1)', padding: '28px 24px 32px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-5 right-5 inline-flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-[var(--fg-3)] hover:bg-white/[0.06] transition-colors"
          style={{ width: 36, height: 36 }}
        >
          <X size={18} strokeWidth={1.6} />
        </button>

        <div
          className="flex items-center justify-center rounded-[14px] mb-5"
          style={{ width: 48, height: 48, background: 'rgba(0,255,135,0.12)', color: 'var(--kiro-green)' }}
        >
          <Landmark size={22} strokeWidth={1.6} />
        </div>

        <h2 className="font-display font-semibold text-[18px] text-[var(--fg-1)] mb-2">
          O que é TESOURO?
        </h2>
        <p className="font-sans text-[14px] text-[var(--fg-2)] leading-relaxed mb-4">
          TESOURO é um título público federal brasileiro em formato digital. Ao receber via PIX
          na Kiro, seu dinheiro é convertido para TESOURO automaticamente.
        </p>

        <div
          className="rounded-[14px] border mb-4"
          style={{ padding: '16px', background: 'rgba(0,255,135,0.05)', borderColor: 'rgba(0,255,135,0.18)' }}
        >
          <div className="font-display font-semibold text-[var(--kiro-green)] text-[15px] mb-1">
            Por que TESOURO?
          </div>
          <div className="font-sans text-[13px] text-[var(--fg-2)]">
            Diferente do saldo em conta comum, o TESOURO rende automaticamente todos os dias —
            sem prazo de carência e sem você precisar fazer nada.
          </div>
        </div>

        <p className="font-sans text-[13px] text-[var(--fg-3)] leading-relaxed">
          Quando quiser, basta sacar via PIX — o TESOURO é convertido de volta para reais na hora.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-[12px] font-display font-semibold text-[14px] cursor-pointer transition-colors"
          style={{
            padding: '14px',
            background: 'rgba(0,255,135,0.12)',
            border: '1px solid rgba(0,255,135,0.22)',
            color: 'var(--kiro-green)',
          }}
        >
          Entendi
        </button>
      </div>
    </div>,
    document.body,
  );
}

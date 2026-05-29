import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from './Button';
import { useEtherfuseKyc } from '@/context/EtherfuseKycContext';

export function EtherfuseKycReviewModal() {
  const { wizardStep, closeWizard } = useEtherfuseKyc();

  if (wizardStep !== 'review') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full md:max-w-[460px] rounded-t-[24px] md:rounded-[24px] border border-[var(--stroke-2)] flex flex-col items-center gap-5 text-center"
        style={{
          padding: '40px 24px 40px',
          background: 'rgba(20,22,32,0.98)',
          backdropFilter: 'blur(24px) saturate(140%)',
          boxShadow: 'var(--shadow-3)',
        }}
      >
        <Loader2 size={40} strokeWidth={1.4} className="animate-spin" style={{ color: 'var(--kiro-green)' }} />
        <div>
          <h2 className="text-[17px] font-semibold text-[var(--fg-1)] mb-1">Verificação em andamento</h2>
          <p className="text-[13px] text-[var(--fg-2)] leading-relaxed">
            Seus documentos estão sendo analisados pelo nosso parceiro. Isso pode levar alguns minutos.
          </p>
        </div>
        <p className="text-[11px] text-[var(--fg-3)] leading-relaxed">
          Você pode fechar esta tela — avisaremos quando a verificação for concluída.
        </p>
        <Button variant="secondary" onClick={closeWizard} className="w-full justify-center">
          Fechar
        </Button>
      </div>
    </div>,
    document.body,
  );
}

import { ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import { useWallet } from '@/context/WalletContext';

export function WalletSignModal() {
  const { needsSignatureConfirmation, confirmDerivation } = useWallet();

  if (!needsSignatureConfirmation) return null;

  const isReturning = !!localStorage.getItem('kiro_stellar_pk');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-[400px] rounded-[var(--radius-xl)] border border-[var(--stroke-2)] flex flex-col items-center gap-5 text-center"
        style={{
          padding: '36px 32px 28px',
          background: 'rgba(20, 22, 32, 0.97)',
          backdropFilter: 'blur(24px) saturate(140%)',
          boxShadow: 'var(--shadow-3)',
        }}
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 64,
            height: 64,
            background: 'rgba(0,255,135,0.08)',
            border: '1px solid rgba(0,255,135,0.20)',
          }}
        >
          <ShieldCheck size={28} strokeWidth={1.5} style={{ color: 'var(--kiro-green)' }} />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-[18px] font-semibold text-[var(--fg-1)]">
            {isReturning ? 'Bem-vindo de volta' : 'Ativar sua conta'}
          </h2>
          <p className="text-[13px] text-[var(--fg-2)] leading-relaxed">
            {isReturning
              ? 'Para confirmar que é você, precisamos de uma verificação rápida.'
              : 'Para começar a usar o Kiro, precisamos de uma confirmação rápida.'}
            {' '}É gratuito e não gera nenhuma cobrança.
          </p>
          <p className="text-[12px]" style={{ color: 'var(--fg-3)' }}>
            Na próxima tela, clique no botão verde para continuar.
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={confirmDerivation}
          className="w-full justify-center"
        >
          {isReturning ? 'Continuar' : 'Ativar conta'}
        </Button>

        <p className="text-[11px] text-[var(--fg-3)]">
          Verificação necessária apenas uma vez por sessão.
        </p>
      </div>
    </div>
  );
}

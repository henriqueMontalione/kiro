import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import { useWallet } from '@/context/WalletContext';
import { getMe } from '@/lib/api/me';

export function WalletSignModal() {
  const { needsSignatureConfirmation, confirmDerivation, disconnect } = useWallet();
  const { getAccessToken, user } = usePrivy();
  const email = user?.email?.address ?? '';
  const [loggingOut, setLoggingOut] = useState(false);
  const [isReturning, setIsReturning] = useState<boolean | null>(null);

  useEffect(() => {
    if (!needsSignatureConfirmation) {
      setIsReturning(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          if (!cancelled) setIsReturning(null);
          return;
        }
        const profile = await getMe(token);
        if (!cancelled) setIsReturning(profile !== null);
      } catch {
        if (!cancelled) setIsReturning(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsSignatureConfirmation, getAccessToken]);

  if (!needsSignatureConfirmation) return null;

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await disconnect();
    } finally {
      setLoggingOut(false);
    }
  }

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
            {isReturning === false ? 'Ativar sua conta' : 'Bem-vindo de volta'}
          </h2>
          {email && (
            <p
              className="text-[12px] text-[var(--fg-3)]"
              style={{ wordBreak: 'break-all' }}
            >
              {email}
            </p>
          )}
          <p className="text-[13px] text-[var(--fg-2)] leading-relaxed">
            {isReturning === false
              ? 'Para começar a usar o Kiro, precisamos de uma confirmação rápida.'
              : 'Para confirmar que é você, precisamos de uma verificação rápida.'}
            {' '}É gratuito e não gera nenhuma cobrança.
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={confirmDerivation}
          className="w-full justify-center"
        >
          {isReturning === false ? 'Ativar conta' : 'Continuar'}
        </Button>

        <p className="text-[11px] text-[var(--fg-3)]">
          Verificação necessária apenas uma vez por sessão.
        </p>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="bg-transparent border-none cursor-pointer text-[12px] text-[var(--fg-3)] hover:text-[var(--fg-1)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ padding: '4px 8px' }}
        >
          {loggingOut ? 'Saindo...' : 'Sair e entrar com outra conta'}
        </button>
      </div>
    </div>
  );
}

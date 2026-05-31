import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from '@/context/WalletContext';
import { useEtherfuseKyc } from '@/context/EtherfuseKycContext';
import { postEtherfuseConsent } from '@/lib/api/kyc';
import { startOnboarding } from '@/lib/anchors/etherfuse/client';

const CUSTOMER_KEY = 'kiro_ef_customer_id';
const BANK_ACCOUNT_KEY = 'kiro_ef_bank_account_id';

export function EtherfuseConsentModal() {
  const { wizardStep, onConsentDone } = useEtherfuseKyc();
  const { getAccessToken } = usePrivy();
  const { publicKey } = useWallet();

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (wizardStep !== 'consent') { setAccepted(false); setErrorMsg(''); }
  }, [wizardStep]);

  if (wizardStep !== 'consent') return null;

  async function handleContinue() {
    if (!accepted || submitting || !publicKey) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      let customerId = localStorage.getItem(CUSTOMER_KEY) ?? crypto.randomUUID();
      let bankAccountId = localStorage.getItem(BANK_ACCOUNT_KEY) ?? crypto.randomUUID();

      const result = await startOnboarding(customerId, bankAccountId, publicKey);
      customerId = result.customerId;
      bankAccountId = result.bankAccountId;
      localStorage.setItem(CUSTOMER_KEY, customerId);
      localStorage.setItem(BANK_ACCOUNT_KEY, bankAccountId);

      await postEtherfuseConsent(token);

      onConsentDone(customerId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao continuar');
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full md:max-w-[460px] rounded-t-[24px] md:rounded-[24px] border border-[var(--stroke-2)] flex flex-col gap-5"
        style={{
          padding: '28px 24px 32px',
          background: 'rgba(20,22,32,0.98)',
          backdropFilter: 'blur(24px) saturate(140%)',
          boxShadow: 'var(--shadow-3)',
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="flex items-center justify-center rounded-[16px]"
            style={{ width: 56, height: 56, background: 'rgba(0,255,135,0.08)', border: '1px solid rgba(0,255,135,0.20)' }}
          >
            <ShieldCheck size={24} strokeWidth={1.5} style={{ color: 'var(--kiro-green)' }} />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--fg-1)]">Depósitos e saques via PIX</h2>
            <p className="text-[13px] text-[var(--fg-2)] leading-relaxed mt-1">
              Para movimentar dinheiro, a Kiro usa a <strong className="text-[var(--fg-1)]">Etherfuse</strong>,
              parceira regulamentada de serviços financeiros.
            </p>
          </div>
        </div>

        <div
          className="rounded-[14px] border flex flex-col gap-3"
          style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderColor: 'var(--stroke-2)' }}
        >
          <p className="text-[13px] text-[var(--fg-2)] font-medium">O que acontece ao continuar:</p>
          <ul className="flex flex-col gap-2">
            {[
              'Seus dados cadastrais serão enviados à Etherfuse para verificação de identidade',
              'Você precisará enviar uma foto do seu documento',
              'Após aprovação, depósitos e saques via PIX ficam liberados',
            ].map((text) => (
              <li key={text} className="flex items-start gap-2 text-[13px] text-[var(--fg-2)]">
                <span className="mt-[3px] flex-shrink-0 w-[6px] h-[6px] rounded-full" style={{ background: 'var(--kiro-green)', marginTop: 6 }} />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-[var(--fg-3)] leading-relaxed text-center">
          A Etherfuse é responsável pelo processamento dos dados compartilhados conforme a legislação vigente.
          A Kiro não armazena cópias dos seus documentos.
        </p>

        {errorMsg && (
          <div
            className="flex items-start gap-2 rounded-[var(--radius-md)] text-[12px]"
            style={{ padding: '10px 12px', background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.25)', color: '#FF8FA3' }}
          >
            <AlertCircle size={14} strokeWidth={1.8} className="flex-shrink-0 mt-[1px]" />
            <span>{errorMsg}</span>
          </div>
        )}

        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-[3px] flex-shrink-0 cursor-pointer"
            style={{ accentColor: 'var(--kiro-green)' }}
          />
          <span className="text-[12px] text-[var(--fg-2)] leading-relaxed">
            Concordo em compartilhar meus dados com a Etherfuse para verificação de identidade,
            conforme os{' '}
            <span className="text-[var(--fg-1)] font-medium">Termos de Uso</span>{' '}
            da Kiro.
          </span>
        </label>

        <Button
          variant="primary"
          size="lg"
          disabled={!accepted || submitting}
          onClick={handleContinue}
          className="w-full justify-center"
        >
          {submitting ? (
            <><Loader2 size={16} strokeWidth={1.8} className="animate-spin" /> Preparando...</>
          ) : (
            'Continuar com cadastro'
          )}
        </Button>
      </div>
    </div>,
    document.body,
  );
}

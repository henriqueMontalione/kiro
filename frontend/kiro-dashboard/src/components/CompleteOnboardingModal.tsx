import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Store, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { useUserProfile } from '@/context/UserProfileContext';
import { useWallet } from '@/context/WalletContext';
import { currentRequiredConsents } from '@/lib/legal';
import { digitsOnly, formatCnpj, formatCpf, formatPhone } from '@/lib/format';

function LogoutLink() {
  const { disconnect } = useWallet();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleClick() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await disconnect();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loggingOut}
      className="bg-transparent border-none cursor-pointer text-[12px] text-[var(--fg-3)] hover:text-[var(--fg-1)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ padding: '4px 8px' }}
    >
      {loggingOut ? 'Saindo...' : 'Sair e entrar com outra conta'}
    </button>
  );
}

type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone';

const PIX_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
};

const PIX_PLACEHOLDERS: Record<PixKeyType, string> = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  email: 'voce@exemplo.com',
  phone: '(11) 91234-5678',
};


const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Converts the form's PIX value to the canonical format expected by the backend. */
function normalizePixKey(type: PixKeyType, raw: string): string {
  switch (type) {
    case 'cpf':
    case 'cnpj':
      return digitsOnly(raw);
    case 'email':
      return raw.trim().toLowerCase();
    case 'phone':
      return `+55${digitsOnly(raw)}`;
  }
}

/** Returns an error message or empty string if the PIX value is valid for the type. */
function validatePixKey(type: PixKeyType, raw: string): string {
  switch (type) {
    case 'cpf':
      return digitsOnly(raw).length === 11 ? '' : 'CPF deve ter 11 dígitos';
    case 'cnpj':
      return digitsOnly(raw).length === 14 ? '' : 'CNPJ deve ter 14 dígitos';
    case 'email':
      return EMAIL_RE.test(raw.trim()) ? '' : 'E-mail inválido';
    case 'phone':
      return digitsOnly(raw).length === 11
        ? ''
        : 'Telefone deve ter DDD + 9 dígitos';
  }
}

/**
 * Full-screen blocking modal shown when the lojista is authenticated but
 * hasn't completed their cadastro in the backend yet (GET /api/me → 404).
 *
 * On submit, POSTs to /api/me; on success, UserProfileContext flips status
 * to 'ready' and the modal unmounts.
 */
export function CompleteOnboardingModal() {
  const {
    status,
    email: privyEmail,
    errorMessage,
    completeOnboarding,
    refresh,
  } = useUserProfile();

  const [storeName, setStoreName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [pixType, setPixType] = useState<PixKeyType>('cpf');
  const [pixValue, setPixValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Pre-fill the email from Privy once available.
  useEffect(() => {
    if (privyEmail && !email) setEmail(privyEmail);
  }, [privyEmail, email]);


  useEffect(() => {
    setPixValue('');
  }, [pixType]);

  if (status === 'error') {
    const handleRetry = async () => {
      setRetrying(true);
      try {
        await refresh();
      } finally {
        setRetrying(false);
      }
    };
    return (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
      >
        <div
          className="w-full max-w-[420px] rounded-[var(--radius-xl)] border border-[var(--stroke-2)] flex flex-col items-center gap-5 text-center"
          style={{
            padding: '32px 28px 24px',
            background: 'rgba(20, 22, 32, 0.98)',
            backdropFilter: 'blur(24px) saturate(140%)',
            boxShadow: 'var(--shadow-3)',
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 56,
              height: 56,
              background: 'rgba(255,77,109,0.10)',
              border: '1px solid rgba(255,77,109,0.30)',
            }}
          >
            <AlertCircle size={24} strokeWidth={1.5} style={{ color: '#FF8FA3' }} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-[var(--fg-1)]">
              Não conseguimos carregar seu cadastro
            </h2>
            <p className="text-[13px] text-[var(--fg-2)] leading-relaxed mt-2">
              Verifique sua conexão e tente novamente. Se o problema persistir,
              entre em contato com o suporte.
            </p>
            {errorMessage && (
              <p className="text-[11px] text-[var(--fg-3)] mt-3 font-mono">
                {errorMessage}
              </p>
            )}
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={handleRetry}
            disabled={retrying}
            className="w-full justify-center"
          >
            {retrying ? (
              <>
                <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
                Tentando...
              </>
            ) : (
              <>
                <RefreshCw size={16} strokeWidth={1.8} />
                Tentar novamente
              </>
            )}
          </Button>
          <LogoutLink />
        </div>
      </div>
    );
  }

  if (status !== 'needs_onboarding') return null;

  const cnpjValid = digitsOnly(cnpj).length === 14;
  const emailValid = EMAIL_RE.test(email.trim());
  const pixError = pixValue ? validatePixKey(pixType, pixValue) : 'Campo obrigatório';
  const formValid =
    storeName.trim().length > 0 &&
    cnpjValid &&
    emailValid &&
    pixError === '' &&
    consentAccepted;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formValid || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await completeOnboarding({
        store_name: storeName.trim(),
        cnpj: digitsOnly(cnpj),
        email: email.trim().toLowerCase(),
        pix_key: normalizePixKey(pixType, pixValue),
        consents: currentRequiredConsents(),
      });
      // On success, status flips to 'ready' and the modal auto-unmounts.
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar cadastro');
      setSubmitting(false);
    }
  }

  function handlePixChange(v: string) {
    if (pixType === 'cpf') setPixValue(formatCpf(digitsOnly(v)));
    else if (pixType === 'cnpj') setPixValue(formatCnpj(digitsOnly(v)));
    else if (pixType === 'phone') setPixValue(formatPhone(digitsOnly(v)));
    else setPixValue(v);
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[460px] rounded-[var(--radius-xl)] border border-[var(--stroke-2)] flex flex-col gap-5"
        style={{
          padding: '28px 28px 24px',
          background: 'rgba(20, 22, 32, 0.98)',
          backdropFilter: 'blur(24px) saturate(140%)',
          boxShadow: 'var(--shadow-3)',
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 56,
              height: 56,
              background: 'rgba(0,255,135,0.08)',
              border: '1px solid rgba(0,255,135,0.20)',
            }}
          >
            <Store size={24} strokeWidth={1.5} style={{ color: 'var(--kiro-green)' }} />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--fg-1)]">Complete seu cadastro</h2>
            <p className="text-[13px] text-[var(--fg-2)] leading-relaxed mt-1">
              Precisamos de algumas informações pra ativar sua conta.
            </p>
          </div>
        </div>

        <Field label="Nome da loja">
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Ex: Padaria do João"
            maxLength={255}
            className="bg-transparent border-none outline-none w-full text-[14px] text-[var(--fg-1)]"
            autoFocus
          />
        </Field>

        <Field label="CNPJ" error={cnpj && !cnpjValid ? 'CNPJ deve ter 14 dígitos' : undefined}>
          <input
            type="text"
            inputMode="numeric"
            value={cnpj}
            onChange={(e) => setCnpj(formatCnpj(digitsOnly(e.target.value)))}
            placeholder="00.000.000/0000-00"
            className="bg-transparent border-none outline-none w-full text-[14px] text-[var(--fg-1)]"
          />
        </Field>

        <Field label="E-mail" error={email && !emailValid ? 'E-mail inválido' : undefined}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="bg-transparent border-none outline-none w-full text-[14px] text-[var(--fg-1)]"
          />
        </Field>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] text-[var(--fg-3)] font-medium uppercase tracking-wide">
            Chave PIX
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(PIX_LABELS) as PixKeyType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPixType(t)}
                className="text-[12px] rounded-[var(--radius-md)] border transition-colors"
                style={{
                  padding: '8px 6px',
                  borderColor: pixType === t ? 'var(--kiro-green)' : 'var(--stroke-3)',
                  background: pixType === t ? 'rgba(0,255,135,0.10)' : 'transparent',
                  color: pixType === t ? 'var(--kiro-green)' : 'var(--fg-2)',
                  cursor: 'pointer',
                }}
              >
                {PIX_LABELS[t]}
              </button>
            ))}
          </div>
          <Field error={pixValue && pixError ? pixError : undefined}>
            <input
              type={pixType === 'email' ? 'email' : 'text'}
              inputMode={pixType === 'email' ? 'text' : 'numeric'}
              value={pixValue}
              onChange={(e) => handlePixChange(e.target.value)}
              placeholder={PIX_PLACEHOLDERS[pixType]}
              className="bg-transparent border-none outline-none w-full text-[14px] text-[var(--fg-1)]"
            />
          </Field>
        </div>

        {errorMsg && (
          <div
            className="flex items-start gap-2 rounded-[var(--radius-md)] text-[12px]"
            style={{
              padding: '10px 12px',
              background: 'rgba(255,77,109,0.08)',
              border: '1px solid rgba(255,77,109,0.25)',
              color: '#FF8FA3',
            }}
          >
            <AlertCircle size={14} strokeWidth={1.8} className="flex-shrink-0 mt-[1px]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* LGPD: explicit consent (Art. 8º). The acceptance is recorded in
            the consent_logs table via the same transaction that creates the
            user, so the backend always has proof of who accepted what. */}
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            className="mt-[3px] flex-shrink-0 cursor-pointer"
            style={{ accentColor: 'var(--kiro-green)' }}
          />
          <span className="text-[12px] text-[var(--fg-2)] leading-relaxed">
            Li e aceito os{' '}
            <span className="text-[var(--fg-1)] font-medium">Termos de Uso</span>{' '}
            e a{' '}
            <span className="text-[var(--fg-1)] font-medium">Política de Privacidade</span>{' '}
            da Kiro.
          </span>
        </label>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!formValid || submitting}
          className="w-full justify-center"
        >
          {submitting ? (
            <>
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
              Salvando...
            </>
          ) : (
            'Finalizar cadastro'
          )}
        </Button>

        <div className="flex justify-center">
          <LogoutLink />
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] text-[var(--fg-3)] font-medium uppercase tracking-wide">
          {label}
        </label>
      )}
      <div
        className="flex items-center rounded-[var(--radius-md)] border"
        style={{
          padding: '12px 14px',
          borderColor: error ? '#FF4D6D55' : 'var(--stroke-3)',
          background: 'var(--bg-3)',
        }}
      >
        {children}
      </div>
      {error && <p className="text-[11px]" style={{ color: '#FF8FA3' }}>{error}</p>}
    </div>
  );
}

import { useState, useEffect, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { UserCheck, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from '@/context/WalletContext';
import { useEtherfuseKyc } from '@/context/EtherfuseKycContext';
import { createKycProfile } from '@/lib/api/kyc';
import { submitKyc } from '@/lib/anchors/etherfuse/client';
import { digitsOnly, formatCpf } from '@/lib/format';

const BANK_ACCOUNT_KEY = 'kiro_ef_bank_account_id';

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
];

function Field({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-[var(--fg-3)] font-medium uppercase tracking-wide">{label}</label>
      <div
        className="flex items-center rounded-[var(--radius-md)] border"
        style={{ padding: '11px 14px', borderColor: error ? '#FF4D6D55' : 'var(--stroke-3)', background: 'var(--bg-3)' }}
      >
        {children}
      </div>
      {error && <p className="text-[11px]" style={{ color: '#FF8FA3' }}>{error}</p>}
    </div>
  );
}

export function EtherfuseKycIdentityModal() {
  const { wizardStep, efCustomerId, onIdentityDone } = useEtherfuseKyc();
  const { getAccessToken } = usePrivy();
  const { publicKey } = useWallet();

  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postal, setPostal] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const postalDigits = digitsOnly(postal);

  useEffect(() => {
    if (postalDigits.length !== 8) { setCepError(''); return; }
    let cancelled = false;
    setCepLoading(true);
    setCepError('');
    fetch(`https://viacep.com.br/ws/${postalDigits}/json/`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.erro) { setCepError('CEP não encontrado'); return; }
        if (data.logradouro) setStreet(data.logradouro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf && BR_STATES.includes(data.uf)) setState(data.uf);
      })
      .catch(() => { if (!cancelled) setCepError('Erro ao buscar CEP'); })
      .finally(() => { if (!cancelled) setCepLoading(false); });
    return () => { cancelled = true; };
  }, [postalDigits]);

  if (wizardStep !== 'identity') return null;

  const cpfDigits = digitsOnly(cpf);

  const formValid =
    givenName.trim().length > 0 &&
    familyName.trim().length > 0 &&
    cpfDigits.length === 11 &&
    birthDate.length === 10 &&
    street.trim().length > 0 &&
    city.trim().length > 0 &&
    BR_STATES.includes(state) &&
    postalDigits.length === 8;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formValid || submitting || !publicKey || !efCustomerId) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const bankAccountId = localStorage.getItem(BANK_ACCOUNT_KEY) ?? '';

      await submitKyc({
        customerId: efCustomerId,
        bankAccountId,
        publicKey,
        givenName: givenName.trim(),
        familyName: familyName.trim(),
        cpf: cpfDigits,
        birthDate,
        addressStreet: street.trim(),
        addressCity: city.trim(),
        addressState: state,
        addressPostalCode: postalDigits,
      });

      await createKycProfile(token, {
        given_name: givenName.trim(),
        family_name: familyName.trim(),
        cpf: cpfDigits,
        birth_date: birthDate,
        address_street: street.trim(),
        address_city: city.trim(),
        address_state: state,
        address_postal_code: postalDigits,
        ef_customer_id: efCustomerId,
      });

      onIdentityDone();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar dados');
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end md:items-center justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full md:max-w-[480px] rounded-t-[24px] md:rounded-[24px] border border-[var(--stroke-2)] flex flex-col gap-4"
        style={{
          padding: '28px 24px 32px',
          background: 'rgba(20,22,32,0.98)',
          backdropFilter: 'blur(24px) saturate(140%)',
          boxShadow: 'var(--shadow-3)',
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center mb-1">
          <div
            className="flex items-center justify-center rounded-[16px]"
            style={{ width: 48, height: 48, background: 'rgba(0,255,135,0.08)', border: '1px solid rgba(0,255,135,0.20)' }}
          >
            <UserCheck size={22} strokeWidth={1.5} style={{ color: 'var(--kiro-green)' }} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-[var(--fg-1)]">Dados pessoais</h2>
            <p className="text-[12px] text-[var(--fg-3)] mt-1">Etapa 1 de 2 — identidade</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome">
            <input
              type="text"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
              placeholder="João"
              autoFocus
              className="bg-transparent border-none outline-none w-full text-[14px] text-[var(--fg-1)]"
            />
          </Field>
          <Field label="Sobrenome">
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Silva"
              className="bg-transparent border-none outline-none w-full text-[14px] text-[var(--fg-1)]"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="CPF" error={cpf && cpfDigits.length !== 11 ? 'CPF inválido' : undefined}>
            <input
              type="text"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(digitsOnly(e.target.value)))}
              placeholder="000.000.000-00"
              className="bg-transparent border-none outline-none w-full text-[14px] text-[var(--fg-1)]"
            />
          </Field>
          <Field label="Data de nascimento">
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date(Date.now() - 18 * 365.25 * 86400_000).toISOString().slice(0, 10)}
              className="bg-transparent border-none outline-none w-full text-[14px] text-[var(--fg-1)]"
            />
          </Field>
        </div>

        <Field label="Logradouro">
          <input
            type="text"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="Av. Paulista, 1000"
            className="bg-transparent border-none outline-none w-full text-[14px] text-[var(--fg-1)]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cidade">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="São Paulo"
              className="bg-transparent border-none outline-none w-full text-[14px] text-[var(--fg-1)]"
            />
          </Field>
          <Field label="CEP" error={
            (postal && postalDigits.length !== 8) ? 'CEP inválido' : cepError || undefined
          }>
            <input
              type="text"
              inputMode="numeric"
              value={postalDigits.length > 5 ? `${postalDigits.slice(0, 5)}-${postalDigits.slice(5)}` : postal}
              onChange={(e) => setPostal(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="00000-000"
              className="bg-transparent border-none outline-none flex-1 min-w-0 text-[14px] text-[var(--fg-1)]"
            />
            {cepLoading && <Loader2 size={13} strokeWidth={1.8} className="animate-spin flex-shrink-0 ml-2" style={{ color: 'var(--fg-3)' }} />}
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-[var(--fg-3)] font-medium uppercase tracking-wide">Estado</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="rounded-[var(--radius-md)] border text-[14px] text-[var(--fg-1)]"
            style={{ padding: '11px 14px', borderColor: 'var(--stroke-3)', background: 'var(--bg-3)' }}
          >
            <option value="">Selecione</option>
            {BR_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {errorMsg && (
          <div
            className="flex items-start gap-2 rounded-[var(--radius-md)] text-[12px]"
            style={{ padding: '10px 12px', background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.25)', color: '#FF8FA3' }}
          >
            <AlertCircle size={14} strokeWidth={1.8} className="flex-shrink-0 mt-[1px]" />
            <span>{errorMsg}</span>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!formValid || submitting}
          className="w-full justify-center mt-1"
        >
          {submitting ? (
            <><Loader2 size={16} strokeWidth={1.8} className="animate-spin" /> Enviando...</>
          ) : (
            'Continuar'
          )}
        </Button>
      </form>
    </div>,
    document.body,
  );
}

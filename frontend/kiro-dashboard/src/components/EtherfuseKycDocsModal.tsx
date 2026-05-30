import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCheck, Camera, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from './Button';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from '@/context/WalletContext';
import { useEtherfuseKyc } from '@/context/EtherfuseKycContext';
import { markKycDocsUploaded } from '@/lib/api/kyc';
import { uploadKycDocuments, sandboxApprove } from '@/lib/anchors/etherfuse/client';
import { compressImage } from '@/lib/image';

const BANK_ACCOUNT_KEY = 'kiro_ef_bank_account_id';
const SANDBOX_ENABLED = import.meta.env.VITE_ETHERFUSE_SANDBOX === 'true';

interface SlotProps {
  label: string;
  hint: string;
  capture?: 'environment' | 'user';
  value: string | null;
  onChange: (dataUrl: string) => void;
  onClear: () => void;
}

function UploadSlot({ label, hint, capture, value, onChange, onClear }: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImage(file);
    onChange(dataUrl);
    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-[var(--fg-3)] font-medium uppercase tracking-wide">{label}</span>
      {value ? (
        <div className="relative rounded-[var(--radius-md)] overflow-hidden border border-[var(--stroke-3)]" style={{ height: 120 }}>
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 rounded-full flex items-center justify-center border-none cursor-pointer"
            style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.6)' }}
            aria-label="Remover foto"
          >
            <X size={14} strokeWidth={2} style={{ color: '#fff' }} />
          </button>
          <div
            className="absolute bottom-2 right-2 rounded-full flex items-center justify-center"
            style={{ width: 22, height: 22, background: 'var(--kiro-green)' }}
          >
            <CheckCircle size={13} strokeWidth={2.5} style={{ color: '#000' }} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed cursor-pointer transition-colors hover:border-[var(--kiro-green)] hover:bg-white/[0.02]"
          style={{ height: 120, borderColor: 'var(--stroke-3)' }}
        >
          <Camera size={22} strokeWidth={1.4} style={{ color: 'var(--fg-3)' }} />
          <span className="text-[12px] text-[var(--fg-3)]">{hint}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture={capture}
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

export function EtherfuseKycDocsModal() {
  const { wizardStep, efCustomerId, onDocsDone } = useEtherfuseKyc();
  const { getAccessToken } = usePrivy();
  const { publicKey } = useWallet();

  const [idFront, setIdFront] = useState<string | null>(null);
  const [idBack, setIdBack] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (wizardStep !== 'docs') return null;

  const allSelected = !!idFront && !!idBack;

  async function handleSubmit() {
    if (!allSelected || submitting || !publicKey || !efCustomerId) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      await uploadKycDocuments(efCustomerId, publicKey, 'document', [
        { label: 'id_front', image: idFront! },
        { label: 'id_back', image: idBack! },
      ]);

      const token = await getAccessToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');
      await markKycDocsUploaded(token);

      // Sandbox: finalize KYC + set up the PIX proxy account on Etherfuse.
      // Without this, /ramp/order rejects with "Proxy account not found"
      // because the customer's bank account wasn't fully provisioned.
      if (SANDBOX_ENABLED) {
        const bankAccountId = localStorage.getItem(BANK_ACCOUNT_KEY) ?? '';
        try {
          await sandboxApprove(efCustomerId, publicKey, bankAccountId);
        } catch (err) {
          console.warn('[EtherfuseKycDocsModal] sandboxApprove failed:', err);
        }
      }

      onDocsDone();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar documentos');
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end md:items-center justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full md:max-w-[480px] rounded-t-[24px] md:rounded-[24px] border border-[var(--stroke-2)] flex flex-col gap-5"
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
            style={{ width: 48, height: 48, background: 'rgba(0,255,135,0.08)', border: '1px solid rgba(0,255,135,0.20)' }}
          >
            <FileCheck size={22} strokeWidth={1.5} style={{ color: 'var(--kiro-green)' }} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-[var(--fg-1)]">Documentos</h2>
            <p className="text-[12px] text-[var(--fg-3)] mt-1">Etapa 2 de 2 — verificação</p>
          </div>
        </div>

        <p className="text-[13px] text-[var(--fg-2)] text-center leading-relaxed">
          Envie fotos da frente e do verso do seu <strong className="text-[var(--fg-1)]">RG ou CNH</strong>.
          As imagens são enviadas diretamente para o parceiro e não ficam armazenadas na Kiro.
        </p>

        <UploadSlot
          label="Frente do documento"
          hint="Toque para fotografar ou selecionar"
          capture="environment"
          value={idFront}
          onChange={setIdFront}
          onClear={() => setIdFront(null)}
        />
        <UploadSlot
          label="Verso do documento"
          hint="Toque para fotografar ou selecionar"
          capture="environment"
          value={idBack}
          onChange={setIdBack}
          onClear={() => setIdBack(null)}
        />

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
          variant="primary"
          size="lg"
          disabled={!allSelected || submitting}
          onClick={handleSubmit}
          className="w-full justify-center"
        >
          {submitting ? (
            <><Loader2 size={16} strokeWidth={1.8} className="animate-spin" /> Enviando...</>
          ) : (
            'Enviar documentos'
          )}
        </Button>
      </div>
    </div>,
    document.body,
  );
}

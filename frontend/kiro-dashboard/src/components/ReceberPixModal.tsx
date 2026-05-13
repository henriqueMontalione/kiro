import { useEffect, useState } from 'react';
import { Copy, Download, X, Zap } from 'lucide-react';
import { Button } from './Button';
import { FakeQR } from './FakeQR';

interface ReceberPixModalProps {
  open: boolean;
  onClose: () => void;
}

/** Full-screen "Receber via PIX" modal with QR code + copyable BR Code. */
export function ReceberPixModal({ open, onClose }: ReceberPixModalProps) {
  const [amount, setAmount] = useState('25,00');

  // ESC closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] max-w-full rounded-[var(--radius-xl)] border border-[var(--stroke-2)]"
        style={{
          background: 'rgba(20, 22, 32, 0.97)',
          backdropFilter: 'blur(24px) saturate(140%)',
          padding: 28,
          boxShadow: 'var(--shadow-3)',
        }}
      >
        <div className="flex justify-between items-center mb-[22px]">
          <h2 className="k-h2">Receber via PIX</h2>
          <button
            type="button"
            onClick={onClose}
            className="bg-transparent border-none text-[var(--fg-3)] cursor-pointer"
            style={{ padding: 4 }}
          >
            <X size={20} strokeWidth={1.6} />
          </button>
        </div>

        <div className="flex flex-col gap-[6px] mb-[18px]">
          <label
            className="text-[11px] text-[var(--fg-3)] font-medium uppercase"
            style={{ letterSpacing: '0.04em' }}
          >
            Valor
          </label>
          <div
            className="flex items-center gap-[10px] border rounded-[var(--radius-md)]"
            style={{
              padding: '14px 16px',
              borderColor: 'var(--stroke-3)',
              background: 'var(--bg-3)',
            }}
          >
            <span className="k-money text-[18px] text-[var(--fg-3)]">R$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent border-none outline-none flex-1 k-money font-medium"
              style={{ fontSize: 28, color: 'var(--kiro-green)' }}
            />
          </div>
        </div>

        <div
          className="flex flex-col items-center gap-3 rounded-[var(--radius-md)]"
          style={{ background: '#FFFFFF', padding: 22 }}
        >
          <FakeQR size={180} />
          <div
            className="k-money text-[12px] font-medium"
            style={{ color: '#0A0B10', letterSpacing: '0.08em' }}
          >
            00020126360014BR.GOV.BCB.PIX0114KIRO.LOJAORIGEM
          </div>
        </div>

        <div
          className="mt-[18px] flex items-center gap-[10px] border rounded-[var(--radius-md)]"
          style={{
            padding: '10px 14px',
            borderColor: 'rgba(0,255,135,0.18)',
            background: 'rgba(0,255,135,0.06)',
          }}
        >
          <Zap size={14} color="var(--kiro-green)" strokeWidth={1.6} />
          <span className="text-[12px] text-[var(--fg-2)]">
            Sem taxas. Cai na sua conta KIRO em segundos.
          </span>
        </div>

        <div className="flex gap-[10px] mt-[22px]">
          <Button variant="secondary" icon={Copy} className="flex-1 justify-center">
            Copiar código
          </Button>
          <Button variant="primary" icon={Download} className="flex-1 justify-center">
            Baixar QR
          </Button>
        </div>
      </div>
    </div>
  );
}

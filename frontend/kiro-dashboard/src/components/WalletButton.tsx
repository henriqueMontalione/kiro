import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, LogOut, Wallet, X } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { truncateKey } from '@/lib/stellar';

/**
 * Desktop variant — connected pill with key + logout, or "Entrar" button.
 */
export function WalletButton() {
  const { isConnected, publicKey, isLoading, connect, disconnect } = useWallet();

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--stroke-2)] bg-transparent px-3 py-[6px] text-[var(--fg-3)] font-sans text-[13px]">
        <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
        Conectando…
      </div>
    );
  }

  if (isConnected && publicKey) {
    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-[var(--stroke-green)] bg-[var(--success-bg)]">
        <div className="inline-flex items-center gap-2 pl-3 pr-2 py-[6px] font-sans text-[13px] text-[var(--kiro-green)]">
          <Wallet size={13} strokeWidth={1.8} />
          <span className="font-mono tracking-tight">{truncateKey(publicKey)}</span>
        </div>
        <button
          type="button"
          onClick={disconnect}
          aria-label="Desconectar carteira"
          title="Desconectar"
          className="inline-flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-[var(--fg-3)] hover:text-[var(--danger)] hover:bg-white/[0.04] transition-colors mr-1"
          style={{ width: 28, height: 28 }}
        >
          <LogOut size={13} strokeWidth={1.8} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--stroke-2)] bg-transparent hover:bg-white/[0.04] transition-colors cursor-pointer text-[var(--fg-2)] hover:text-[var(--fg-1)] font-sans text-[13px]"
      style={{ padding: '6px 16px' }}
    >
      <Wallet size={14} strokeWidth={1.6} />
      Entrar
    </button>
  );
}

/**
 * Compact variant for the mobile header — icon-only that opens a bottom sheet.
 * Rendered via createPortal to escape the header's backdrop-filter stacking context.
 */
export function WalletButtonMobile() {
  const { isConnected, isLoading, connect, disconnect } = useWallet();

  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  if (isLoading) {
    return (
      <div className="inline-flex items-center justify-center" style={{ width: 44, height: 44 }}>
        <Loader2 size={20} strokeWidth={1.6} className="animate-spin text-[var(--fg-3)]" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={isConnected ? disconnect : () => setSheetOpen(true)}
        aria-label={isConnected ? 'Desconectar carteira' : 'Conectar carteira'}
        className="relative inline-flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer transition-colors hover:bg-white/[0.04]"
        style={{ width: 44, height: 44, color: isConnected ? 'var(--kiro-green)' : 'var(--fg-2)' }}
      >
        <Wallet size={22} strokeWidth={1.6} />
      </button>

      {sheetOpen && createPortal(
        <div
          onClick={() => setSheetOpen(false)}
          className="fixed inset-0 z-[100] flex items-end"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full border-t"
            style={{
              background: 'rgba(20, 22, 32, 0.97)',
              backdropFilter: 'blur(24px) saturate(140%)',
              WebkitBackdropFilter: 'blur(24px) saturate(140%)',
              borderColor: 'var(--stroke-2)',
              borderTopLeftRadius: 'var(--radius-xl)',
              borderTopRightRadius: 'var(--radius-xl)',
              padding: '18px 12px calc(24px + env(safe-area-inset-bottom))',
              boxShadow: 'var(--shadow-3)',
            }}
          >
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="font-display text-[16px] font-semibold text-[var(--fg-1)] m-0">
                Conectar
              </h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Fechar"
                className="bg-transparent border-none text-[var(--fg-3)] cursor-pointer"
                style={{ padding: 4 }}
              >
                <X size={20} strokeWidth={1.6} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setSheetOpen(false); connect(); }}
              className="w-full flex items-center gap-3 text-left bg-transparent border-none cursor-pointer hover:bg-white/[0.04] transition-colors rounded-[var(--radius-md)]"
              style={{ padding: '12px 14px' }}
            >
              <span
                className="inline-flex items-center justify-center rounded-[8px] flex-shrink-0"
                style={{
                  width: 32, height: 32,
                  background: 'rgba(0,255,135,0.10)',
                  border: '1px solid var(--stroke-green)',
                }}
              >
                <Wallet size={16} strokeWidth={1.7} color="var(--kiro-green)" />
              </span>
              <div className="flex flex-col">
                <span className="font-sans text-[13.5px] font-medium text-[var(--fg-1)]">
                  Entrar na sua conta
                </span>
                <span className="font-sans text-[11.5px] text-[var(--fg-3)] mt-[1px]">
                  Email, Google ou Apple
                </span>
              </div>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

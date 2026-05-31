import { Loader2, LogIn } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';

/**
 * Desktop variant — login CTA when disconnected. Connected identity and
 * logout live in the user menu (Header), so the connected state renders nothing.
 */
export function WalletButton() {
  const { isConnected, publicKey, isLoading, connect } = useWallet();

  if (isConnected && publicKey) return null;

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--stroke-2)] bg-transparent px-3 py-[6px] text-[var(--fg-3)] font-sans text-[13px]">
        <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
        Entrando…
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      className="inline-flex items-center gap-2 rounded-full border-none cursor-pointer transition-colors font-sans text-[13px] font-medium"
      style={{
        padding: '8px 18px',
        background: 'var(--kiro-green)',
        color: 'var(--bg-0)',
      }}
    >
      <LogIn size={14} strokeWidth={1.8} />
      Entrar
    </button>
  );
}

/**
 * Mobile variant — login CTA when disconnected; nothing when connected
 * (logout lives in the avatar menu of MobileHeader).
 */
export function WalletButtonMobile() {
  const { isConnected, isLoading, connect } = useWallet();

  if (isConnected) return null;

  if (isLoading) {
    return (
      <div className="inline-flex items-center justify-center" style={{ width: 44, height: 44 }}>
        <Loader2 size={20} strokeWidth={1.6} className="animate-spin text-[var(--fg-3)]" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      aria-label="Entrar"
      className="inline-flex items-center gap-2 rounded-full border-none cursor-pointer transition-colors font-sans text-[13px] font-medium"
      style={{
        padding: '8px 16px',
        background: 'var(--kiro-green)',
        color: 'var(--bg-0)',
      }}
    >
      <LogIn size={16} strokeWidth={1.8} />
      Entrar
    </button>
  );
}

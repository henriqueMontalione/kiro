import { Loader2, Wallet } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';

/**
 * Desktop variant — "Entrar" CTA when disconnected. Connected identity and
 * logout live in the user chip (Header), so the connected state renders nothing.
 */
export function WalletButton() {
  const { isConnected, publicKey, isLoading, connect } = useWallet();

  if (isConnected && publicKey) return null;

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--stroke-2)] bg-transparent px-3 py-[6px] text-[var(--fg-3)] font-sans text-[13px]">
        <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
        Conectando…
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
 * Compact variant for the mobile header — icon-only that opens the Privy
 * login modal directly on tap (or disconnects when already connected).
 */
export function WalletButtonMobile() {
  const { isConnected, isLoading, connect, disconnect } = useWallet();

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
      onClick={isConnected ? disconnect : connect}
      aria-label={isConnected ? 'Desconectar carteira' : 'Conectar carteira'}
      className="relative inline-flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer transition-colors hover:bg-white/[0.04]"
      style={{ width: 44, height: 44, color: isConnected ? 'var(--kiro-green)' : 'var(--fg-2)' }}
    >
      <Wallet size={22} strokeWidth={1.6} />
    </button>
  );
}

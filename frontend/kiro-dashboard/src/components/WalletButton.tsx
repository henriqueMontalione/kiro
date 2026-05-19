import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Fingerprint,
  Loader2,
  LogOut,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { useUserProfile } from '@/context/UserProfileContext';
import { truncateKey } from '@/lib/stellar';

/**
 * Desktop variant — full pill with address + status when connected,
 * "Entrar / Criar conta" chooser when not.
 */
export function WalletButton() {
  const {
    isConnected,
    publicKey,
    isLoading,
    walletType,
    hasPasskeyWallet,
    passkeySupported,
    connect,
    createPasskeyAccount,
    loginWithPasskey,
    disconnect,
    forgetPasskeyAccount,
  } = useWallet();
  const profile = useUserProfile();

  const [menuOpen, setMenuOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-outside + ESC to close
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function handlePrimary() {
    setErrorMsg(null);
    setMenuOpen(false);
    try {
      if (hasPasskeyWallet) {
        await loginWithPasskey();
      } else {
        await createPasskeyAccount(profile.name);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar.';
      setErrorMsg(msg);
      console.error('[WalletButton] passkey flow failed:', err);
    }
  }

  function handleKitConnect() {
    setMenuOpen(false);
    setErrorMsg(null);
    connect();
  }

  function handleForget() {
    if (!confirm('Esquecer esta conta passkey? Sem a sincronização do passkey você não conseguirá recuperar o acesso.')) {
      return;
    }
    setMenuOpen(false);
    forgetPasskeyAccount();
  }

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
          {walletType === 'passkey' && <Fingerprint size={13} strokeWidth={1.8} />}
          {walletType !== 'passkey' && (
            <span
              className="rounded-full bg-[var(--kiro-green)]"
              style={{ width: 7, height: 7, boxShadow: '0 0 6px rgba(0,255,135,0.7)' }}
              aria-hidden="true"
            />
          )}
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

  const primaryLabel = hasPasskeyWallet ? 'Entrar' : 'Criar conta';

  return (
    <div ref={wrapRef} className="relative">
      <div className="inline-flex items-stretch rounded-full border border-[var(--stroke-2)] bg-transparent hover:bg-white/[0.04] transition-colors">
        <button
          type="button"
          onClick={handlePrimary}
          disabled={!passkeySupported}
          title={passkeySupported ? undefined : 'Passkeys não suportadas neste navegador'}
          className="inline-flex items-center gap-2 cursor-pointer text-[var(--fg-2)] hover:text-[var(--fg-1)] font-sans text-[13px] bg-transparent border-none disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ padding: '6px 12px 6px 12px' }}
        >
          <Fingerprint size={14} strokeWidth={1.6} />
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Outras opções de carteira"
          aria-expanded={menuOpen}
          className="inline-flex items-center justify-center cursor-pointer text-[var(--fg-3)] hover:text-[var(--fg-1)] bg-transparent border-none border-l border-l-[var(--stroke-2)]"
          style={{ padding: '0 10px' }}
        >
          <ChevronDown
            size={14}
            strokeWidth={1.8}
            style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
          />
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 rounded-[var(--radius-md)] border overflow-hidden"
          style={{
            background: 'rgba(20, 22, 32, 0.97)',
            borderColor: 'var(--stroke-2)',
            backdropFilter: 'blur(16px) saturate(140%)',
            WebkitBackdropFilter: 'blur(16px) saturate(140%)',
            boxShadow: 'var(--shadow-3)',
            width: 280,
            zIndex: 50,
          }}
        >
          <MenuItem
            icon={<Fingerprint size={16} strokeWidth={1.7} color="var(--kiro-green)" />}
            title={hasPasskeyWallet ? 'Entrar com Face ID' : 'Criar conta com Face ID'}
            subtitle={
              hasPasskeyWallet
                ? 'Use a passkey deste dispositivo'
                : 'Biometria, sem seedphrase'
            }
            onClick={handlePrimary}
            disabled={!passkeySupported}
            primary
          />

          <div style={{ height: 1, background: 'var(--stroke-1)' }} />

          <MenuItem
            icon={<Wallet size={16} strokeWidth={1.7} color="var(--fg-2)" />}
            title="Carteira Stellar existente"
            subtitle="Freighter, Albedo, xBull, Lobstr"
            onClick={handleKitConnect}
          />

          {hasPasskeyWallet && (
            <>
              <div style={{ height: 1, background: 'var(--stroke-1)' }} />
              <MenuItem
                icon={<Trash2 size={15} strokeWidth={1.7} color="var(--danger)" />}
                title="Esquecer conta passkey"
                subtitle="Remove o blob local — passkey do OS continua"
                onClick={handleForget}
                danger
              />
            </>
          )}
        </div>
      )}

      {errorMsg && (
        <div
          className="absolute right-0 top-full mt-2 rounded-[var(--radius-sm)] border font-sans text-[12px] max-w-[320px]"
          style={{
            background: 'rgba(255,77,109,0.10)',
            borderColor: 'rgba(255,77,109,0.30)',
            color: '#FF8FA3',
            padding: '8px 12px',
            zIndex: 50,
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
  primary,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-start gap-3 text-left bg-transparent border-none cursor-pointer hover:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      style={{ padding: '12px 14px' }}
    >
      <span
        className="inline-flex items-center justify-center rounded-[8px] flex-shrink-0 mt-[2px]"
        style={{
          width: 32,
          height: 32,
          background: primary
            ? 'rgba(0,255,135,0.10)'
            : danger
            ? 'rgba(255,77,109,0.10)'
            : 'rgba(255,255,255,0.05)',
          border: primary
            ? '1px solid var(--stroke-green)'
            : danger
            ? '1px solid rgba(255,77,109,0.30)'
            : '1px solid var(--stroke-2)',
        }}
      >
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span
          className="font-sans text-[13.5px] font-medium"
          style={{
            color: danger ? 'var(--danger)' : 'var(--fg-1)',
          }}
        >
          {title}
        </span>
        <span className="font-sans text-[11.5px] text-[var(--fg-3)] mt-[1px]">{subtitle}</span>
      </div>
    </button>
  );
}

/**
 * Compact variant for the mobile header — icon-only.
 *
 * Mobile tap behavior is passkey-first because Freighter (the dominant
 * Stellar wallet) is a Chrome extension and doesn't exist on mobile. Users
 * who need Albedo/Lobstr deeplinks can switch to desktop.
 */
export function WalletButtonMobile() {
  const {
    isConnected,
    isLoading,
    walletType,
    hasPasskeyWallet,
    passkeySupported,
    createPasskeyAccount,
    loginWithPasskey,
    disconnect,
  } = useWallet();
  const profile = useUserProfile();

  if (isLoading) {
    return (
      <div className="inline-flex items-center justify-center" style={{ width: 44, height: 44 }}>
        <Loader2 size={20} strokeWidth={1.6} className="animate-spin text-[var(--fg-3)]" />
      </div>
    );
  }

  async function handleTap() {
    if (isConnected) {
      disconnect();
      return;
    }
    if (!passkeySupported) return;
    try {
      if (hasPasskeyWallet) {
        await loginWithPasskey();
      } else {
        await createPasskeyAccount(profile.name);
      }
    } catch (err) {
      console.error('[WalletButtonMobile] passkey flow failed:', err);
    }
  }

  const Icon = isConnected && walletType === 'passkey' ? Fingerprint : Wallet;

  return (
    <button
      type="button"
      onClick={handleTap}
      disabled={!isConnected && !passkeySupported}
      aria-label={isConnected ? 'Desconectar carteira' : 'Entrar com passkey'}
      className="relative inline-flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer transition-colors hover:bg-white/[0.04] disabled:opacity-40"
      style={{ width: 44, height: 44, color: isConnected ? 'var(--kiro-green)' : 'var(--fg-2)' }}
    >
      <Icon size={22} strokeWidth={1.6} />
      {isConnected && (
        <span
          className="absolute rounded-full bg-[var(--kiro-green)]"
          style={{
            top: 10,
            right: 10,
            width: 8,
            height: 8,
            boxShadow: '0 0 8px rgba(0,255,135,0.7)',
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

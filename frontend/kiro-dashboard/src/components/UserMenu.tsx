import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useUserProfile } from '@/context/UserProfileContext';
import { useWallet } from '@/context/WalletContext';

type UserMenuMode = 'chip' | 'iconButton';

interface UserMenuProps {
  /** "chip" renders avatar + name + chevron (desktop). "iconButton" renders a Settings icon button (mobile). */
  mode?: UserMenuMode;
}

export function UserMenu({ mode = 'chip' }: UserMenuProps) {
  const { name, role, initials, photoUrl } = useUserProfile();
  const { disconnect } = useWallet();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  async function handleLogout() {
    if (loggingOut) return;
    const ok = window.confirm(
      'Tem certeza que deseja sair? Você precisará entrar de novo na próxima vez.',
    );
    if (!ok) return;
    setLoggingOut(true);
    try {
      await disconnect();
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      {mode === 'iconButton' ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Abrir menu da conta"
          className="inline-flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-[var(--fg-1)] hover:bg-white/[0.04] transition-colors"
          style={{ width: 44, height: 44 }}
        >
          <Settings size={22} strokeWidth={1.6} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex items-center gap-[10px] rounded-full border border-[var(--stroke-2)] bg-transparent hover:bg-white/[0.04] cursor-pointer text-[var(--fg-1)] font-sans text-[13px]"
          style={{ padding: '6px 10px 6px 6px' }}
        >
          <span
            className="inline-flex items-center justify-center rounded-full font-display font-semibold text-[12px] text-white overflow-hidden flex-shrink-0"
            style={{
              width: 30,
              height: 30,
              background: photoUrl ? 'var(--bg-3)' : 'linear-gradient(135deg, #9D4EDD, #7B2CBF)',
              letterSpacing: '0.04em',
            }}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <span className="flex flex-col items-start leading-[1.15]">
            <span className="font-medium">{name}</span>
            <span className="text-[11px] text-[var(--fg-3)]">{role}</span>
          </span>
          <ChevronDown size={14} color="var(--fg-3)" strokeWidth={1.6} />
        </button>
      )}

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 rounded-[var(--radius-md)] border border-[var(--stroke-2)] bg-[var(--bg-2)]"
          style={{
            top: 'calc(100% + 8px)',
            minWidth: 220,
            padding: 4,
            boxShadow: 'var(--shadow-3)',
          }}
        >
          <MenuItem
            icon={Settings}
            onClick={() => {
              setOpen(false);
              navigate('/config');
            }}
          >
            Configurações
          </MenuItem>
          <MenuItem icon={LogOut} onClick={handleLogout} disabled={loggingOut} danger>
            {loggingOut ? 'Saindo...' : 'Sair'}
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  onClick,
  disabled,
  danger,
  children,
}: {
  icon: typeof Settings;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-[10px] w-full bg-transparent border-none cursor-pointer rounded-[8px] hover:bg-white/[0.04] transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        padding: '10px 12px',
        color: danger ? '#FF4D6D' : 'var(--fg-1)',
        font: 'inherit',
        fontSize: 14,
      }}
    >
      <Icon size={16} strokeWidth={1.7} />
      {children}
    </button>
  );
}

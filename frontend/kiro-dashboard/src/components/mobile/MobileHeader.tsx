import { useState } from 'react';
import { Bell } from 'lucide-react';
import { NotificationsPopover } from '../NotificationsPopover';
import { WalletButtonMobile } from '../WalletButton';
import { MERCHANT } from '@/lib/mocks';

/**
 * Sticky top bar for the mobile shell.
 *
 * Layout: gradient avatar + "Olá, {merchant}" greeting on the left,
 * notification bell (with green dot) on the right. Sized for thumb reach
 * — the bell hit area is 44×44 to meet WCAG 2.5.5 touch-target guidance.
 */
export function MobileHeader() {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--stroke-1)] bg-[var(--bg-0)]/95 backdrop-blur-md flex-shrink-0"
      style={{ height: 64, padding: '0 16px' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="inline-flex items-center justify-center rounded-full font-display font-semibold text-[13px] text-white flex-shrink-0"
          style={{
            width: 40,
            height: 40,
            background: 'linear-gradient(135deg, #9D4EDD, #7B2CBF)',
            letterSpacing: '0.04em',
          }}
          aria-hidden="true"
        >
          {MERCHANT.initials}
        </span>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[12px] text-[var(--fg-3)] font-sans">Olá,</span>
          <span className="text-[15px] text-[var(--fg-1)] font-display font-semibold truncate">
            {MERCHANT.name}
          </span>
        </div>
      </div>

      <div className="flex items-center">
        <WalletButtonMobile />
        <button
        type="button"
        onClick={() => setNotifOpen((o) => !o)}
        aria-label="Notificações"
        aria-expanded={notifOpen}
        className="relative inline-flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-[var(--fg-1)] hover:bg-white/[0.04] transition-colors"
        style={{ width: 44, height: 44 }}
      >
        <Bell size={22} strokeWidth={1.6} />
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
      </button>
      </div>

      {notifOpen && <NotificationsPopover onClose={() => setNotifOpen(false)} />}
    </header>
  );
}

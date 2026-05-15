import { useState } from 'react';
import { Bell, HelpCircle, ChevronDown } from 'lucide-react';
import { TopTabs } from './TopTabs';
import { IconButton } from './IconButton';
import { NotificationsPopover } from './NotificationsPopover';
import { WalletButton } from './WalletButton';
import { MERCHANT } from '@/lib/mocks';

/** Top app header: tabs left, notifs / help / user-chip right. */
export function Header() {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header
      className="flex items-center justify-between border-b border-[var(--stroke-1)] bg-[var(--bg-0)] flex-shrink-0 relative"
      style={{ height: 64, padding: '0 28px' }}
    >
      <TopTabs />

      <div className="flex items-center gap-[10px]">
        <WalletButton />
        <IconButton
          icon={Bell}
          badge
          active={notifOpen}
          onClick={() => setNotifOpen((o) => !o)}
          title="Notificações"
        />
        <IconButton icon={HelpCircle} title="Ajuda" />
        <UserChip />
      </div>

      {notifOpen && <NotificationsPopover onClose={() => setNotifOpen(false)} />}
    </header>
  );
}

function UserChip() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-[10px] rounded-full border border-[var(--stroke-2)] bg-transparent hover:bg-white/[0.04] cursor-pointer text-[var(--fg-1)] font-sans text-[13px]"
      style={{ padding: '6px 10px 6px 6px' }}
    >
      <span
        className="inline-flex items-center justify-center rounded-full font-display font-semibold text-[12px] text-white"
        style={{
          width: 30,
          height: 30,
          background: 'linear-gradient(135deg, #9D4EDD, #7B2CBF)',
          letterSpacing: '0.04em',
        }}
      >
        {MERCHANT.initials}
      </span>
      <span className="flex flex-col items-start leading-[1.15]">
        <span className="font-medium">{MERCHANT.name}</span>
        <span className="text-[11px] text-[var(--fg-3)]">{MERCHANT.role}</span>
      </span>
      <ChevronDown size={14} color="var(--fg-3)" strokeWidth={1.6} />
    </button>
  );
}

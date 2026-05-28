import { useState } from 'react';
import { Bell, HelpCircle } from 'lucide-react';
import { TopTabs } from './TopTabs';
import { IconButton } from './IconButton';
import { NotificationsPopover } from './NotificationsPopover';
import { WalletButton } from './WalletButton';
import { UserMenu } from './UserMenu';
import { useNotifications } from '@/context/NotificationsContext';
import { useWallet } from '@/context/WalletContext';

/** Top app header: tabs left, notifs / help / user-chip right. */
export function Header() {
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const { isConnected } = useWallet();

  return (
    <header
      className="flex items-center justify-between border-b border-[var(--stroke-1)] bg-[var(--bg-0)] flex-shrink-0 relative"
      style={{ height: 64, padding: '0 28px' }}
    >
      <TopTabs />

      <div className="flex items-center gap-[10px]">
        <WalletButton />
        {isConnected && (
          <>
            <IconButton
              icon={Bell}
              badge={unreadCount > 0}
              active={notifOpen}
              onClick={() => setNotifOpen((o) => !o)}
              title="Notificações"
            />
            <IconButton icon={HelpCircle} title="Ajuda" />
            <UserMenu />
          </>
        )}
      </div>

      {notifOpen && <NotificationsPopover onClose={() => setNotifOpen(false)} />}
    </header>
  );
}

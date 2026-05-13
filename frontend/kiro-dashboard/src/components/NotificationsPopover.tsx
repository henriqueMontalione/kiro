import { Diamond, TrendingUp, Crown, type LucideIcon } from 'lucide-react';

interface NotificationItem {
  Icon: LucideIcon;
  color: string;
  title: string;
  ago: string;
}

const NOTIFICATIONS: NotificationItem[] = [
  { Icon: Diamond, color: '#00FF87', title: 'Você recebeu R$ 259,90 via PIX', ago: 'há 8 minutos' },
  { Icon: TrendingUp, color: '#00FF87', title: '+R$ 12,40 de rendimento creditado', ago: 'há 2 horas' },
  { Icon: Crown, color: '#C99EFA', title: 'KIRO Pro está em pré-lançamento', ago: 'há 1 dia' },
];

/** Notifications dropdown opened from the bell IconButton in the header. */
export function NotificationsPopover({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute z-50 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--stroke-2)]"
      style={{
        top: 58,
        right: 28,
        width: 340,
        background: 'rgba(20, 22, 32, 0.96)',
        backdropFilter: 'blur(20px) saturate(140%)',
        boxShadow: 'var(--shadow-3)',
      }}
    >
      <div
        className="flex justify-between items-center border-b border-[var(--stroke-1)]"
        style={{ padding: '14px 16px' }}
      >
        <span className="font-display font-semibold text-[14px] text-[var(--fg-1)]">
          Notificações
        </span>
        <span className="k-money text-[11px] text-[var(--fg-3)]">3 novas</span>
      </div>

      {NOTIFICATIONS.map((n, i) => (
        <div
          key={i}
          className="flex gap-3 items-start border-b border-[var(--stroke-1)] cursor-pointer"
          style={{ padding: '12px 16px' }}
        >
          <div
            className="flex items-center justify-center rounded-[8px] flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              background: 'rgba(0,255,135,0.10)',
            }}
          >
            <n.Icon size={16} color={n.color} strokeWidth={1.6} />
          </div>
          <div className="flex-1">
            <div className="text-[13px] text-[var(--fg-1)] leading-[1.35]">{n.title}</div>
            <div className="k-money text-[11px] text-[var(--fg-3)] mt-[2px]">{n.ago}</div>
          </div>
        </div>
      ))}

      <div className="text-center" style={{ padding: '12px 16px' }}>
        <button
          type="button"
          onClick={onClose}
          className="font-display text-[12px] text-[var(--kiro-green)] bg-transparent border-none cursor-pointer"
        >
          Ver todas as notificações →
        </button>
      </div>
    </div>
  );
}

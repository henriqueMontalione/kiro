import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface IconButtonProps {
  icon: LucideIcon;
  /** Show a green badge dot in the top-right (e.g. unread notifications). */
  badge?: boolean;
  active?: boolean;
  title?: string;
  size?: number;
  onClick?: () => void;
}

/** Square icon-only button used in the top-right header (bell, help). */
export function IconButton({
  icon: Icon,
  badge,
  active,
  title,
  size = 38,
  onClick,
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'relative inline-flex items-center justify-center rounded-[10px]',
        'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]',
        active
          ? 'bg-white/[0.06] text-[var(--kiro-green)] border border-[rgba(0,255,135,0.30)]'
          : 'bg-transparent text-[var(--fg-2)] border border-transparent hover:bg-white/[0.06]',
      )}
      style={{ width: size, height: size }}
    >
      <Icon size={18} strokeWidth={1.6} />
      {badge && (
        <span
          className="absolute rounded-full bg-[var(--kiro-green)]"
          style={{
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            boxShadow: '0 0 0 2px var(--bg-0)',
          }}
        />
      )}
    </button>
  );
}

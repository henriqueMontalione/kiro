import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Card shell — translucent surface, hairline border, optional glass blur. */
export function Card({
  children,
  glass = true,
  className,
}: {
  children: ReactNode;
  glass?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden p-6 rounded-[var(--radius-lg)] border',
        glass ? 'border-[var(--stroke-2)]' : 'border-[var(--stroke-1)]',
        className,
      )}
      style={{
        background: glass ? 'rgba(255,255,255,0.035)' : 'var(--bg-1)',
        backdropFilter: glass ? 'blur(20px) saturate(140%)' : undefined,
        WebkitBackdropFilter: glass ? 'blur(20px) saturate(140%)' : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** Small heading row above a card body — title left, optional action right. */
export function CardEyebrow({
  children,
  info,
  action,
}: {
  children: ReactNode;
  info?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-[14px]">
      <span className="font-display text-[13px] font-medium text-[var(--fg-1)] tracking-[-0.005em]">
        {children}
      </span>
      {info && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--fg-3)"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 11v6M12 7h.01" />
        </svg>
      )}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

import type { ReactNode } from 'react';
import { Check, Info, Crown } from 'lucide-react';

export type Status = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';

interface StatusTagProps {
  status?: Status;
  withIcon?: boolean;
  children: ReactNode;
}

const STYLES: Record<Status, { bg: string; fg: string; border: string }> = {
  success: { bg: 'rgba(0,255,135,0.10)', fg: '#00FF87', border: 'rgba(0,255,135,0.30)' },
  warning: { bg: 'rgba(255,181,71,0.10)', fg: '#FFB547', border: 'rgba(255,181,71,0.30)' },
  danger: { bg: 'rgba(255,77,109,0.10)', fg: '#FF4D6D', border: 'rgba(255,77,109,0.30)' },
  info: { bg: 'rgba(91,182,255,0.10)', fg: '#5BB6FF', border: 'rgba(91,182,255,0.30)' },
  purple: { bg: 'rgba(123,44,191,0.18)', fg: '#C99EFA', border: 'rgba(123,44,191,0.40)' },
  neutral: { bg: 'rgba(255,255,255,0.06)', fg: 'var(--fg-2)', border: 'var(--stroke-2)' },
};

const ICONS: Partial<Record<Status, typeof Check>> = {
  success: Check,
  warning: Info,
  danger: Info,
  info: Info,
  purple: Crown,
};

/** Inline status pill. Defaults to the success / "Concluído" style. */
export function StatusTag({ status = 'success', withIcon = true, children }: StatusTagProps) {
  const s = STYLES[status];
  const Icon = ICONS[status];
  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-full px-[10px] py-[3px] font-sans text-[12px] font-medium"
      style={{
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
      }}
    >
      {withIcon && Icon && <Icon size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

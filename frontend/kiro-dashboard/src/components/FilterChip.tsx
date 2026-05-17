import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FilterChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

/** Pill filter used to slice the Transações table. */
export function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full font-sans text-[12px] font-medium cursor-pointer transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] border',
        active
          ? 'bg-[rgba(0,255,135,0.10)] border-[rgba(0,255,135,0.30)] text-[var(--kiro-green)]'
          : 'bg-transparent border-[var(--stroke-2)] text-[var(--fg-2)] hover:bg-white/[0.06]',
      )}
      style={{ padding: '7px 14px' }}
    >
      {children}
    </button>
  );
}

import { useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'purple' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
}

const SIZES: Record<ButtonSize, { padding: string; fontSize: number; iconSize: number }> = {
  sm: { padding: '8px 14px', fontSize: 12, iconSize: 14 },
  md: { padding: '12px 22px', fontSize: 14, iconSize: 16 },
  lg: { padding: '16px 28px', fontSize: 16, iconSize: 18 },
};

const VARIANTS: Record<ButtonVariant, { base: string; hover: string }> = {
  primary: {
    base: 'bg-[var(--kiro-green)] text-[var(--fg-on-green)] shadow-[var(--shadow-glow-green)]',
    hover: 'hover:bg-[var(--kiro-green-soft)]',
  },
  secondary: {
    base: 'bg-white/[0.06] text-[var(--fg-1)] border border-[var(--stroke-3)]',
    hover: 'hover:bg-white/[0.10]',
  },
  ghost: {
    base: 'bg-transparent text-[var(--fg-2)]',
    hover: 'hover:bg-white/5 hover:text-[var(--fg-1)]',
  },
  purple: {
    base: 'bg-[var(--kiro-purple)] text-[var(--fg-1)]',
    hover: 'hover:bg-[var(--kiro-purple-soft)]',
  },
  danger: {
    base: 'bg-[rgba(255,77,109,0.15)] text-[#FF4D6D] border border-[rgba(255,77,109,0.30)]',
    hover: 'hover:bg-[rgba(255,77,109,0.20)]',
  },
};

/**
 * Primary action button. The `primary` variant carries the brand green +
 * green outer-halo — there should be at most one of these per view.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const sz = SIZES[size];
  const vr = VARIANTS[variant];

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap font-display font-medium tracking-[-0.005em]',
        'rounded-[var(--radius-md)] border border-transparent',
        'transition-[background,transform,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out)]',
        vr.base,
        !disabled && vr.hover,
        disabled && 'opacity-40 cursor-not-allowed',
        className,
      )}
      style={{
        padding: sz.padding,
        fontSize: sz.fontSize,
        transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
      }}
    >
      {Icon && <Icon size={sz.iconSize} strokeWidth={1.6} />}
      {children}
      {IconRight && <IconRight size={sz.iconSize} strokeWidth={1.6} />}
    </button>
  );
}

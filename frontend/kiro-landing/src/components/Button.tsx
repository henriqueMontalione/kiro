import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
  className?: string;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps | 'href'> & {
    href?: undefined;
  };

type ButtonAsAnchor = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const SIZES: Record<ButtonSize, { padding: string; fontSize: number; iconSize: number }> = {
  md: { padding: '12px 22px', fontSize: 14, iconSize: 16 },
  lg: { padding: '16px 28px', fontSize: 16, iconSize: 18 },
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--kiro-green)] text-[var(--fg-on-green)] shadow-[var(--shadow-glow-green)] hover:bg-[var(--kiro-green-soft)]',
  secondary:
    'bg-white/[0.06] text-[var(--fg-1)] border border-[var(--stroke-3)] hover:bg-white/[0.10]',
  ghost: 'bg-transparent text-[var(--fg-2)] hover:bg-white/5 hover:text-[var(--fg-1)]',
};

/**
 * Polymorphic Button — renders as <a> when `href` is provided, else <button>.
 * Visual parity with the dashboard's Button for design-system consistency.
 */
export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    children,
    className,
    ...rest
  } = props;

  const sz = SIZES[size];
  const classes = cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-display font-medium tracking-[-0.005em]',
    'rounded-[var(--radius-md)] border border-transparent no-underline',
    'transition-[background,transform,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out)]',
    'cursor-pointer active:scale-[0.97]',
    VARIANTS[variant],
    className,
  );
  const style = { padding: sz.padding, fontSize: sz.fontSize };

  const inner = (
    <>
      {Icon && <Icon size={sz.iconSize} strokeWidth={1.6} />}
      {children}
      {IconRight && <IconRight size={sz.iconSize} strokeWidth={1.6} />}
    </>
  );

  if (rest.href !== undefined) {
    const anchorRest = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className={classes} style={style} {...anchorRest}>
        {inner}
      </a>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={classes} style={style} {...buttonRest}>
      {inner}
    </button>
  );
}

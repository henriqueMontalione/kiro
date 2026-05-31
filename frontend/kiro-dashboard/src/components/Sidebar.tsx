import { NavLink } from 'react-router-dom';
import {
  House,
  ArrowLeftRight,
  Link2,
  Users,
  BarChart3,
  Puzzle,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { NAV_ITEMS } from '@/lib/mocks';
import { KiroLogo } from './KiroLogo';
import { ProUpgradeCard } from './ProUpgradeCard';

const ICON_MAP: Record<string, LucideIcon> = {
  House,
  ArrowLeftRight,
  Link2,
  Users,
  BarChart3,
  Puzzle,
  Settings,
};

/** Fixed left navigation rail (248px). The "Pro" card pins to the bottom. */
export function Sidebar() {
  return (
    <aside
      className="flex-shrink-0 flex flex-col gap-1 border-r border-[var(--stroke-1)] bg-[var(--bg-0)] min-h-full"
      style={{ width: 248, padding: '22px 16px' }}
    >
      <div className="flex items-center px-2 pb-[18px]">
        <KiroLogo size={28} />
      </div>

      {NAV_ITEMS.map((item) => (
        <SidebarItem
          key={item.id}
          to={item.to}
          label={item.label}
          Icon={ICON_MAP[item.icon] ?? House}
        />
      ))}

      <div className="flex-1" />
      <ProUpgradeCard />
    </aside>
  );
}

function SidebarItem({ to, label, Icon }: { to: string; label: string; Icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => {
        const base =
          'flex items-center gap-3 rounded-[10px] border font-sans text-[13.5px] font-medium ' +
          'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] no-underline';
        const active =
          'bg-[rgba(0,255,135,0.08)] text-[var(--kiro-green)] border-[rgba(0,255,135,0.22)]';
        const inactive =
          'bg-transparent text-[var(--fg-2)] border-transparent hover:bg-white/[0.04] hover:text-[var(--fg-1)]';
        return [base, isActive ? active : inactive].join(' ');
      }}
      style={{ padding: '11px 14px' }}
    >
      <Icon size={18} strokeWidth={1.6} />
      {label}
    </NavLink>
  );
}

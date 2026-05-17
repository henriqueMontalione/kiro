import { NavLink } from 'react-router-dom';
import { TOP_TABS } from '@/lib/mocks';

/** Horizontal tabs under the header. Active item gets a 2px green underline. */
export function TopTabs() {
  return (
    <nav className="flex items-center gap-1">
      {TOP_TABS.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.to}
          className={({ isActive }) => {
            const base =
              'cursor-pointer bg-transparent font-sans text-[14px] font-medium border-b-2 relative top-[1px] no-underline';
            const active = 'text-[var(--fg-1)] border-[var(--kiro-green)]';
            const inactive = 'text-[var(--fg-3)] border-transparent';
            return [base, isActive ? active : inactive].join(' ');
          }}
          style={{ padding: '18px 16px 16px' }}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

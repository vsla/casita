import { Ellipsis } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { cn } from '../../lib/cn';
import { Dialog } from '../ui/dialog';
import { Header } from './Header';
import { MOBILE_TABS, NAV, SETTINGS_NAV, type NavItem } from './nav';

function SideItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      aria-label={item.label}
      title={item.label}
      className={({ isActive }) =>
        cn('press relative grid size-14 place-items-center rounded-2xl', isActive ? 'text-sage-deep' : 'text-ink-soft hover:bg-paper-2')
      }
    >
      {({ isActive }) => (
        <>
          {/* Indicador desliza entre os ícones (Motion, ~260 ms) */}
          {isActive && (
            <motion.span
              layoutId="nav-active"
              className="absolute inset-0 rounded-2xl bg-sage-soft shadow-sm"
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            />
          )}
          <item.icon className="relative size-6" />
        </>
      )}
    </NavLink>
  );
}

function SideNav() {
  return (
    <nav aria-label="Navegação principal" className="card flex flex-col items-center gap-2 rounded-3xl px-2 py-3 max-md:hidden">
      {NAV.map((n) => (
        <SideItem key={n.to} item={n} />
      ))}
      <div className="flex-1" />
      <SideItem item={SETTINGS_NAV} />
    </nav>
  );
}

function BottomNav() {
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();
  const tabs = NAV.filter((n) => MOBILE_TABS.includes(n.to));
  const extra = [...NAV.filter((n) => !MOBILE_TABS.includes(n.to)), SETTINGS_NAV];
  const inExtra = extra.some((n) => pathname.startsWith(n.to));

  const tabClass = (active: boolean) =>
    cn('press flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-semibold', active ? 'text-sage-deep' : 'text-muted');

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-paper/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => tabClass(isActive)}>
            <Icon className="size-6" />
            {label}
          </NavLink>
        ))}
        <button className={tabClass(inExtra)} onClick={() => setMore(true)}>
          <Ellipsis className="size-6" />
          Mais
        </button>
      </nav>
      <Dialog open={more} onOpenChange={setMore} title="Mais">
        <div className="grid grid-cols-3 gap-3">
          {extra.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMore(false)}
              className={({ isActive }) =>
                cn('press flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold', isActive ? 'border-sage bg-sage-soft text-sage-deep' : 'border-line bg-white/60')
              }
            >
              <Icon className="size-7" strokeWidth={1.6} />
              {label}
            </NavLink>
          ))}
        </div>
      </Dialog>
    </>
  );
}

export function Shell({ online, children }: { online: boolean; children: ReactNode }) {
  return (
    <div className="kiosk flex h-dvh flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-5 md:pt-4 md:pb-4">
      <Header online={online} />
      <div className="flex min-h-0 flex-1 gap-4">
        <SideNav />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-28 md:pb-2 no-scrollbar">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}

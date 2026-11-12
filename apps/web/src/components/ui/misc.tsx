import { ChevronRight, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { LeafSprig } from '../layout/illustrations';

export function Avatar({ name, color, size = 28, className }: { name: string; color: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-full font-bold text-white', className)}
      style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'sage' | 'clay' | 'danger' | 'teal'; className?: string }) {
  const tones = {
    neutral: 'bg-paper-2 text-ink-soft',
    sage: 'bg-sage-wash text-sage-deep',
    clay: 'bg-clay-soft text-[#9a5a2e]',
    danger: 'bg-danger-soft text-danger',
    teal: 'bg-teal-soft text-[#3d7d76]',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-wash px-3 py-1 text-xs text-ink-soft">
      {children}
      <Info className="size-3.5" />
    </span>
  );
}

export function LiveDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-soft">
      <span className={cn('size-2 rounded-full', on ? 'bg-leaf' : 'bg-[#c8c0b3]')} />
      {label}
    </span>
  );
}

/** Card base dos widgets (todos os widgets usam este contêiner) */
export function Card({
  icon,
  title,
  action,
  to,
  leaf,
  className,
  bodyClassName,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  /** Título vira link para a tela completa */
  to?: string;
  leaf?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const heading = (
    <>
      <span className="text-ink-soft [&>svg]:size-[22px]">{icon}</span>
      <h2 className="truncate font-display text-[1.2rem] font-medium tracking-tight xl:text-[1.1rem]">{title}</h2>
      {to && <ChevronRight className="size-4 shrink-0 text-muted" />}
    </>
  );
  return (
    <section className={cn('card relative flex min-h-0 flex-col overflow-hidden', className)}>
      {leaf && <LeafSprig className="pointer-events-none absolute -top-1 right-14 w-24 opacity-60" aria-hidden />}
      <header className="relative flex min-h-14 items-center gap-2.5 px-5 pt-3 pb-1 xl:min-h-12 xl:px-4 xl:pt-2.5">
        {to ? (
          <Link to={to} className="press -m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1">
            {heading}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">{heading}</div>
        )}
        {action}
      </header>
      <div className={cn('relative min-h-0 flex-1 px-5 pb-4 xl:px-4 xl:pb-3.5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Cabeçalho das telas internas */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[1.9rem] leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

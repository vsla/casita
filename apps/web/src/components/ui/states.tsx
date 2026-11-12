import type { UseQueryResult } from '@tanstack/react-query';
import { CloudOff, PlugZap, RotateCcw, Sprout } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8" />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action, compact }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 text-center', compact ? 'py-3' : 'py-10')}>
      <span className="text-sage [&>svg]:size-8">{icon ?? <Sprout strokeWidth={1.4} />}</span>
      <p className={cn('font-display text-ink', compact ? 'text-base' : 'text-lg')}>{title}</p>
      {hint && <p className="max-w-xs text-sm text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 text-center', compact ? 'py-3' : 'py-10')} role="alert">
      <CloudOff className="size-7 text-clay" strokeWidth={1.5} />
      <p className="text-sm text-ink-soft">{errorMessage(error)}</p>
      {onRetry && (
        <button onClick={onRetry} className="press flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-sage-deep hover:bg-sage-wash">
          <RotateCcw className="size-4" /> Tentar de novo
        </button>
      )}
    </div>
  );
}

/** Integração não conectada: deixa claro que não há dado real, sem simular nada */
export function UnavailableState({ title, hint, compact }: { title: string; hint?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 text-center text-ink-soft', compact ? 'py-2' : 'py-10')}>
      <PlugZap className="size-7 text-muted" strokeWidth={1.4} />
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Renderiza loading/erro/vazio de forma uniforme para qualquer consulta */
export function QueryState<T>({
  query,
  isEmpty,
  empty,
  loading,
  compact,
  children,
}: {
  query: UseQueryResult<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  loading?: ReactNode;
  compact?: boolean;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <ListSkeleton rows={compact ? 3 : 5} />}</>;
  if (query.isError && query.data === undefined) return <ErrorState error={query.error} onRetry={() => query.refetch()} compact={compact} />;
  const data = query.data as T;
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState title="Nada por aqui" compact={compact} />}</>;
  return <>{children(data)}</>;
}

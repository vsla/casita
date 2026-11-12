import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Diálogo centralizado no painel e folha inferior no celular.
 * Animações via data-state (entrada 240–280 ms, saída 180–200 ms).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-[#3a3833]/25 backdrop-blur-[2px] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <RD.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed z-50 flex max-h-[92dvh] flex-col border border-line bg-paper text-ink shadow-2xl outline-none',
            // celular: folha inferior
            'inset-x-0 bottom-0 rounded-t-[1.75rem] pb-[env(safe-area-inset-bottom)] data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in',
            // tablet/painel: centralizado
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(92vw,32rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.5rem] sm:pb-0 sm:data-[state=closed]:animate-out sm:data-[state=open]:animate-in',
            wide && 'sm:w-[min(94vw,48rem)]',
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line sm:hidden" />
          <div className="flex items-start justify-between gap-4 px-6 pt-4 sm:pt-5">
            <div>
              <RD.Title className="font-display text-xl">{title}</RD.Title>
              {description ? (
                <RD.Description className="mt-0.5 text-sm text-ink-soft">{description}</RD.Description>
              ) : (
                <RD.Description className="sr-only">{title}</RD.Description>
              )}
            </div>
            <RD.Close aria-label="Fechar" className="press -mr-2 grid size-11 shrink-0 place-items-center rounded-full bg-paper-2 text-ink-soft">
              <X className="size-5" />
            </RD.Close>
          </div>
          <div className="min-h-0 overflow-y-auto px-6 pt-4 pb-6">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

/** Confirmação para ações destrutivas */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Excluir',
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <button className="press h-11 rounded-xl px-4 font-semibold text-ink-soft hover:bg-paper-2" onClick={() => onOpenChange(false)}>
          Cancelar
        </button>
        <button
          className="press h-11 rounded-xl bg-danger px-4 font-semibold text-white disabled:opacity-50"
          disabled={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

import { CalendarPlus, CircleCheck, Image, MessageSquare, PawPrint, Plus, ShoppingCart } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useOpenForm, type FormRequest } from '../../features/forms';
import { cn } from '../../lib/cn';

const ACTIONS: { label: string; icon: typeof Plus; req: FormRequest }[] = [
  { label: 'Evento', icon: CalendarPlus, req: { kind: 'event' } },
  { label: 'Tarefa', icon: CircleCheck, req: { kind: 'task' } },
  { label: 'Compra', icon: ShoppingCart, req: { kind: 'shopping' } },
  { label: 'Recado', icon: MessageSquare, req: { kind: 'note' } },
  { label: 'Rotina pet', icon: PawPrint, req: { kind: 'petActivity' } },
  { label: 'Foto', icon: Image, req: { kind: 'photo' } },
];

/** Botão "+" universal no cabeçalho, com a altura toda do header; o menu desce dele */
export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const openForm = useOpenForm();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative z-40 flex self-stretch">
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-[#3a3833]/20 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
      <button
        aria-label={open ? 'Fechar' : 'Adicionar'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="press relative flex w-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-sage text-white shadow-[0_8px_20px_-10px_rgb(85_122_104/0.7)] hover:bg-sage-deep md:w-16 xl:w-20"
      >
        <Plus className={cn('size-7 transition-transform duration-250 xl:size-8', open && 'rotate-45')} strokeWidth={2.4} />
        <span className="text-[11px] font-semibold max-md:hidden">{open ? 'Fechar' : 'Adicionar'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-full right-0 mt-2 flex w-56 flex-col gap-1 rounded-2xl border border-line bg-paper p-2 shadow-xl"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            style={{ transformOrigin: 'top right' }}
          >
            {ACTIONS.map((a, i) => (
              <motion.button
                key={a.label}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0, transition: { delay: i * 0.025, duration: 0.2 } }}
                onClick={() => {
                  setOpen(false);
                  openForm(a.req);
                }}
                className="press flex h-12 items-center gap-3 rounded-xl px-3 text-left font-semibold hover:bg-sage-wash"
              >
                <a.icon className="size-5 text-sage-deep" />
                {a.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

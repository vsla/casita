import type { ShoppingItem } from '@home-hub/shared';
import { ShoppingBasket, ShoppingCart } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AddButton } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/form';
import { Card } from '../../components/ui/misc';
import { EmptyState, QueryState } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { useShopping } from '../../lib/queries';
import { useOpenForm } from '../forms';
import { useToggleShopping } from './useShopping';

export function ShoppingRow({ item, onToggle, onOpen, dense }: { item: ShoppingItem; onToggle: () => void; onOpen: () => void; dense?: boolean }) {
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="border-b border-line/70 last:border-0">
      <div className={cn('flex items-center gap-3', dense ? 'py-[7px]' : 'py-3')}>
        <Checkbox checked={item.checked} label={item.name} onChange={onToggle} size={dense ? 'md' : 'lg'} />
        <button onClick={onOpen} className="press flex min-w-0 flex-1 items-baseline justify-between gap-2 text-left">
          <span className={cn('truncate', !dense && 'text-base font-semibold', item.checked && 'text-muted line-through')}>{item.name}</span>
          {item.quantity && <span className="shrink-0 text-sm text-muted">{item.quantity}</span>}
        </button>
      </div>
    </motion.li>
  );
}

export function ShoppingWidget() {
  const q = useShopping();
  const openForm = useOpenForm();
  const toggle = useToggleShopping();
  const pending = q.data?.filter((i) => !i.checked).length ?? 0;

  return (
    <Card
      icon={<ShoppingCart />}
      title={pending ? `Compras · ${pending}` : 'Compras'}
      to="/compras"
      action={<AddButton label="Adicionar item" onClick={() => openForm({ kind: 'shopping' })} />}
    >
      <QueryState
        query={q}
        compact
        isEmpty={(rows) => rows.length === 0}
        empty={<EmptyState compact icon={<ShoppingBasket strokeWidth={1.4} />} title="Lista vazia" hint="Toque em + para adicionar." />}
      >
        {(rows) => (
          <ul className="h-full overflow-y-auto no-scrollbar">
            <AnimatePresence initial={false}>
              {rows.map((i) => (
                <ShoppingRow key={i.id} dense item={i} onToggle={() => toggle.mutate(i)} onOpen={() => openForm({ kind: 'shopping', item: i })} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </QueryState>
    </Card>
  );
}

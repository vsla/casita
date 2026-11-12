import { shoppingCategoryLabels, type ShoppingCategory, type ShoppingItem } from '@home-hub/shared';
import { Plus, ShoppingBasket, Sparkles } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/form';
import { PageHeader } from '../../components/ui/misc';
import { EmptyState, QueryState } from '../../components/ui/states';
import { api } from '../../lib/api';
import { useApiMutation, useShopping, useShoppingSuggestions } from '../../lib/queries';
import { useOpenForm } from '../forms';
import { guessCategory } from './ShoppingForm';
import { ShoppingRow } from './ShoppingWidget';
import { useToggleShopping } from './useShopping';

export function ShoppingPage() {
  const q = useShopping();
  const { data: suggestions = [] } = useShoppingSuggestions();
  const openForm = useOpenForm();
  const toggle = useToggleShopping();
  const [quick, setQuick] = useState('');

  const add = useApiMutation((body: { name: string; category: ShoppingCategory }) => api('/shopping', { body }), {
    invalidate: [['shopping']],
    success: (_r, v) => `${v.name} adicionado`,
  });
  const clear = useApiMutation(() => api('/shopping/clear-checked', { body: {} }), { invalidate: [['shopping']], success: 'Lista limpa' });

  const quickAdd = (name: string, category?: ShoppingCategory) => {
    if (!name.trim()) return;
    add.mutate({ name: name.trim(), category: category ?? guessCategory(name) });
    setQuick('');
  };

  const checkedCount = q.data?.filter((i) => i.checked).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Compras"
        subtitle="Lista compartilhada — marque enquanto estiver no mercado"
        actions={
          checkedCount > 0 && (
            <Button variant="outline" loading={clear.isPending} onClick={() => clear.mutate(undefined)}>
              Limpar {checkedCount} marcado(s)
            </Button>
          )
        }
      />

      {/* Adição rápida: digitar e Enter. A categoria é adivinhada pelo nome. */}
      <form
        className="card mb-4 flex gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          quickAdd(quick);
        }}
      >
        <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Adicionar item…" maxLength={100} aria-label="Novo item" />
        <Button type="submit" size="icon" aria-label="Adicionar" disabled={!quick.trim()}>
          <Plus />
        </Button>
        <Button variant="outline" onClick={() => openForm({ kind: 'shopping' })} className="max-sm:hidden">
          Com quantidade
        </Button>
      </form>

      {suggestions.length > 0 && (
        <div className="mb-5 flex gap-2 overflow-x-auto no-scrollbar">
          <span className="flex shrink-0 items-center gap-1 text-sm text-muted">
            <Sparkles className="size-4" /> Sempre compram:
          </span>
          {suggestions.map((s) => (
            <button key={s.name} onClick={() => quickAdd(s.name, s.category)} className="press h-10 shrink-0 rounded-full border border-line bg-white/70 px-4 text-sm">
              + {s.name}
            </button>
          ))}
        </div>
      )}

      <QueryState
        query={q}
        isEmpty={(r) => r.length === 0}
        empty={<EmptyState icon={<ShoppingBasket strokeWidth={1.4} />} title="Lista vazia" hint="Adicione itens pelo campo acima ou pelo botão +." />}
      >
        {(rows) => {
          const byCat = new Map<ShoppingCategory, ShoppingItem[]>();
          for (const i of rows.filter((r) => !r.checked)) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);
          const done = rows.filter((r) => r.checked);
          return (
            <div className="grid gap-4 md:grid-cols-2">
              {[...byCat.entries()].map(([cat, items]) => (
                <section key={cat} className="card px-5 py-2">
                  <h2 className="pt-2 text-sm font-bold tracking-wide text-muted uppercase">{shoppingCategoryLabels[cat]}</h2>
                  <ul>
                    <AnimatePresence initial={false}>
                      {items.map((i) => (
                        <ShoppingRow key={i.id} item={i} onToggle={() => toggle.mutate(i)} onOpen={() => openForm({ kind: 'shopping', item: i })} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              ))}
              {done.length > 0 && (
                <section className="card px-5 py-2 opacity-80 md:col-span-2">
                  <h2 className="pt-2 text-sm font-bold tracking-wide text-muted uppercase">No carrinho · {done.length}</h2>
                  <ul className="md:columns-2">
                    {done.map((i) => (
                      <ShoppingRow key={i.id} item={i} onToggle={() => toggle.mutate(i)} onOpen={() => openForm({ kind: 'shopping', item: i })} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}

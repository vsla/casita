import { shoppingCategories, shoppingCategoryLabels, type ShoppingCategory, type ShoppingItem } from '@home-hub/shared';
import { Plus, Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Field, Input, Select } from '../../components/ui/form';
import { api } from '../../lib/api';
import { useApiMutation, useShoppingSuggestions } from '../../lib/queries';

// Palpite de categoria pelo nome, para a adição rápida não exigir escolha
const GUESS: [RegExp, ShoppingCategory][] = [
  [/banana|maç|tomate|alface|cebola|alho|fruta|batata|limão|verdura|legume|cenoura|mamão|manga/i, 'hortifruti'],
  [/pão|bolo|biscoito|torrada/i, 'padaria'],
  [/carne|frango|peixe|camarão|linguiça|bife/i, 'acougue'],
  [/leite|queijo|iogurte|manteiga|presunto|requeijão|ovo/i, 'laticinios'],
  [/água|suco|refri|cerveja|vinho|café/i, 'bebidas'],
  [/detergente|sabão|amaciante|desinfetante|esponja|água sanitária|multiuso/i, 'limpeza'],
  [/papel higi|shampoo|sabonete|pasta de dente|desodorante|escova/i, 'higiene'],
  [/ração|petisco|areia|tapete higi/i, 'pets'],
  [/arroz|feijão|macarrão|açúcar|sal|óleo|azeite|farinha|molho|tempero/i, 'mercearia'],
];
export const guessCategory = (name: string): ShoppingCategory => GUESS.find(([re]) => re.test(name))?.[1] ?? 'outros';

export function ShoppingForm({ item, onDone }: { item?: ShoppingItem; onDone: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item?.quantity ?? '');
  const [category, setCategory] = useState<ShoppingCategory | ''>(item?.category ?? '');
  const { data: suggestions = [] } = useShoppingSuggestions();

  const add = useApiMutation(
    (body: { name: string; quantity: string | null; category: ShoppingCategory }) =>
      item ? api(`/shopping/${item.id}`, { method: 'PATCH', body }) : api('/shopping', { body }),
    { invalidate: [['shopping']], success: (_r, v) => (item ? 'Item atualizado' : `${v.name} adicionado`) },
  );
  const remove = useApiMutation(() => api(`/shopping/${item!.id}`, { method: 'DELETE' }), { invalidate: [['shopping']] });

  const submit = async (n = name, q = quantity, c = category) => {
    if (!n.trim()) return;
    await add.mutateAsync({ name: n.trim(), quantity: q.trim() || null, category: c || guessCategory(n) });
    if (item) return onDone();
    // Continua aberto para adicionar vários seguidos
    setName('');
    setQuantity('');
    setCategory('');
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="Item">
            <Input autoFocus required maxLength={100} placeholder="Ex.: Café" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Qtd.">
            <Input maxLength={30} placeholder="2 kg" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
        </div>
        <Field label="Categoria">
          <Select value={category || (name ? guessCategory(name) : 'outros')} onChange={(e) => setCategory(e.target.value as ShoppingCategory)}>
            {shoppingCategories.map((c) => (
              <option key={c} value={c}>
                {shoppingCategoryLabels[c]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          {item && (
            <Button
              variant="danger"
              size="icon"
              aria-label="Remover item"
              onClick={async () => {
                await remove.mutateAsync(undefined);
                onDone();
              }}
            >
              <Trash />
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" loading={add.isPending} disabled={!name.trim()}>
            {item ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      </form>

      {!item && suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-soft">Adição rápida</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => submit(s.name, '', s.category)}
                className="press flex h-11 items-center gap-1.5 rounded-full border border-line bg-white/70 px-4 text-sm"
              >
                <Plus className="size-4 text-sage" /> {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {!item && (
        <Button variant="ghost" onClick={onDone}>
          Concluir
        </Button>
      )}
    </div>
  );
}

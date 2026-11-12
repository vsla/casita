import { widgetLabels, type DashboardLayout, type WidgetId, type WidgetSize } from '@home-hub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, EyeOff, Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useApiMutation, useLayout, useMe } from '../../lib/queries';
import { useDevice } from '../../lib/useDevice';
import { packLayout, type Placed, type Slot } from './pack';
import { MOBILE_ORDER, slotsFor, WIDGETS } from './registry';

const DEFAULT: DashboardLayout = { preset: 'balanced', hidden: [] };
const colSpan: Record<number, string> = { 1: '', 2: 'md:col-span-2' };
// Altura mínima no celular/tablet, onde os cards crescem com o conteúdo
const MIN_H: Partial<Record<string, string>> = { camera: 'max-xl:min-h-64', photos: 'max-xl:min-h-72', agenda: 'max-xl:min-h-96', music: 'max-xl:min-h-48' };

export function Dashboard() {
  const device = useDevice();
  const { data: layout = DEFAULT } = useLayout(device);
  const { data: me } = useMe();
  const [params] = useSearchParams();
  // Edição manual (/?editar): só no painel/PC e para quem pode mudar o layout
  const editing = params.has('editar') && device === 'panel' && !!me && me.role !== 'kiosk';

  const slots = slotsFor(layout);
  const ordered = device === 'mobile' ? [...slots].sort((a, b) => MOBILE_ORDER.indexOf(a.id) - MOBILE_ORDER.indexOf(b.id)) : slots;
  // Painel (xl): posições calculadas para ocupar a tela toda, mesmo com widgets ocultos.
  // No layout personalizado os tamanhos são os escolhidos à mão.
  const grid = packLayout(slots, { grow: layout.preset !== 'custom' });
  const pos = new Map(grid.items.map((p) => [p.id, p]));

  return (
    <>
      <div
        style={{ '--rows': grid.template, '--cols': `repeat(${grid.cols},minmax(0,1fr))` } as CSSProperties}
        className="grid gap-4 md:grid-cols-2 xl:h-full xl:grid-cols-[var(--cols)] xl:grid-rows-[var(--rows)] xl:gap-3"
      >
        {ordered.map((s, i) => {
          const p = pos.get(s.id);
          return (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: editing ? 0 : i * 0.03 }}
              style={p && ({ '--gc': `${p.x + 1} / span ${p.w}`, '--gr': `${p.y + 1} / span ${p.h}` } as CSSProperties)}
              className={cn('relative min-h-0 min-w-0 [&>*]:h-full xl:[grid-column:var(--gc)] xl:[grid-row:var(--gr)]', colSpan[s.col ?? 1], MIN_H[s.id])}
            >
              {WIDGETS[s.id]()}
              {editing && p && <EditOverlay layout={layout} grid={grid.items} slots={slots} at={p} />}
            </motion.div>
          );
        })}
        {editing && <FreeCells items={grid.items} rows={grid.rows} cols={grid.cols} />}
      </div>
      {editing && <EditBar layout={layout} slots={slots} />}
    </>
  );
}

// ---------- Edição manual ----------

function useSaveLayout() {
  const qc = useQueryClient();
  const save = useApiMutation((l: DashboardLayout) => api('/layout?device=panel', { method: 'PUT', body: l }), { invalidate: [['layout']] });
  return (l: DashboardLayout) => {
    qc.setQueryData(['layout', 'panel'], l); // resposta imediata
    save.mutate(l);
  };
}

/** Parte do que está na tela: ordem atual e o tamanho que cada card ocupa agora */
function toCustom(layout: DashboardLayout, slots: Slot[], grid: Placed[]): NonNullable<DashboardLayout['custom']> {
  if (layout.preset === 'custom' && layout.custom) return layout.custom;
  const sizes: Partial<Record<WidgetId, WidgetSize>> = {};
  for (const p of grid) sizes[p.id] = { col: Math.min(2, p.w), row: Math.min(3, p.h) };
  return { order: slots.map((s) => s.id), sizes };
}

/** Aplica a mudança só se o resultado couber na grade */
function tryLayout(next: DashboardLayout, save: (l: DashboardLayout) => void) {
  if (!packLayout(slotsFor(next), { grow: false }).fits) return toast.error('Não cabe na tela. Diminua ou oculte outro card primeiro.');
  save(next);
}

function EditOverlay({ layout, grid, slots, at }: { layout: DashboardLayout; grid: Placed[]; slots: Slot[]; at: Placed }) {
  const save = useSaveLayout();
  const custom = toCustom(layout, slots, grid);
  const size = custom.sizes[at.id] ?? { col: 1, row: 1 };
  const visibleOrder = custom.order.filter((id) => !layout.hidden.includes(id));
  const idx = visibleOrder.indexOf(at.id);

  const apply = (c: typeof custom, hidden = layout.hidden) => tryLayout({ preset: 'custom', hidden, custom: c }, save);
  const resize = (s: WidgetSize) => apply({ ...custom, sizes: { ...custom.sizes, [at.id]: s } });
  const move = (dir: -1 | 1) => {
    const other = visibleOrder[idx + dir];
    if (!other) return;
    const order = [...custom.order];
    const a = order.indexOf(at.id);
    const b = order.indexOf(other);
    [order[a], order[b]] = [order[b]!, order[a]!];
    apply({ ...custom, order });
  };

  const btn = 'size-10 rounded-full bg-white/90 text-ink [&_svg]:size-5';
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] bg-ink/55 p-2 text-white backdrop-blur-[2px]">
      <p className="text-center text-sm font-bold">
        {widgetLabels[at.id]} · {size.col}×{size.row}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button size="icon" className={btn} aria-label="Mover para antes" disabled={idx <= 0} onClick={() => move(-1)}>
          <ArrowLeft />
        </Button>
        <Button size="icon" className={btn} aria-label="Mover para depois" disabled={idx >= visibleOrder.length - 1} onClick={() => move(1)}>
          <ArrowRight />
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs font-semibold">
        <span className="flex items-center gap-1">
          Largura
          <Button size="icon" className={btn} aria-label="Mais estreito" disabled={size.col <= 1} onClick={() => resize({ ...size, col: size.col - 1 })}>
            <Minus />
          </Button>
          <Button size="icon" className={btn} aria-label="Mais largo" disabled={size.col >= 2} onClick={() => resize({ ...size, col: size.col + 1 })}>
            <Plus />
          </Button>
        </span>
        <span className="flex items-center gap-1">
          Altura
          <Button size="icon" className={btn} aria-label="Mais baixo" disabled={size.row <= 1} onClick={() => resize({ ...size, row: size.row - 1 })}>
            <Minus />
          </Button>
          <Button size="icon" className={btn} aria-label="Mais alto" disabled={size.row >= 3} onClick={() => resize({ ...size, row: size.row + 1 })}>
            <Plus />
          </Button>
        </span>
      </div>
      <Button size="sm" variant="ghost" className="text-white hover:bg-white/15" onClick={() => apply(custom, [...layout.hidden, at.id])}>
        <EyeOff /> Ocultar
      </Button>
    </div>
  );
}

/** Células livres aparecem tracejadas enquanto edita */
function FreeCells({ items, rows, cols }: { items: Placed[]; rows: number; cols: number }) {
  const used = new Set(items.flatMap((p) => Array.from({ length: p.w * p.h }, (_, i) => `${p.x + (i % p.w)},${p.y + Math.floor(i / p.w)}`)));
  const free = Array.from({ length: rows * cols }, (_, i) => [i % cols, Math.floor(i / cols)] as const).filter(([x, y]) => !used.has(`${x},${y}`));
  return free.map(([x, y]) => (
    <div
      key={`${x},${y}`}
      style={{ gridColumn: x + 1, gridRow: y + 1 }}
      className="grid place-items-center rounded-[var(--radius-card)] border-2 border-dashed border-sage/50 text-sm font-semibold text-sage-deep/70"
    >
      Espaço livre
    </div>
  ));
}

function EditBar({ layout, slots }: { layout: DashboardLayout; slots: Slot[] }) {
  const navigate = useNavigate();
  const save = useSaveLayout();
  const grid = packLayout(slots, { grow: layout.preset !== 'custom' }).items;
  const custom = toCustom(layout, slots, grid);
  const show = (id: WidgetId) => {
    // volta pequeno (1×1) para ter mais chance de caber
    tryLayout({ preset: 'custom', hidden: layout.hidden.filter((h) => h !== id), custom: { ...custom, sizes: { ...custom.sizes, [id]: { col: 1, row: 1 } } } }, save);
  };
  return (
    <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit max-w-[95vw] flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper/95 px-4 py-2.5 shadow-lg backdrop-blur">
      <span className="text-sm font-semibold text-ink-soft">Editando o layout</span>
      {layout.hidden.map((id) => (
        <Button key={id} size="sm" variant="outline" onClick={() => show(id)}>
          <Plus /> {widgetLabels[id]}
        </Button>
      ))}
      <Button size="sm" onClick={() => navigate('/')}>
        <Check /> Concluir
      </Button>
    </div>
  );
}

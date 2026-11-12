import type { WidgetId } from '@home-hub/shared';

export type Slot = { id: WidgetId; col?: number; row?: number };
export type Placed = { id: WidgetId; x: number; y: number; w: number; h: number };

// 4 colunas; com cards demais para 4×3, a grade ganha uma 5ª coluna (cards mais estreitos)
const BASE_COLS = 4;
const WIDE_COLS = 5;
const MAX_ROWS = 3;
// Quem cresce primeiro quando sobra espaço
const GROW_PRIORITY: WidgetId[] = ['agenda', 'camera', 'photos', 'music', 'pets', 'notes', 'tasks', 'shopping', 'laundry'];
// Linhas com agenda ou câmera ficam mais altas que as demais
const FEATURED: WidgetId[] = ['agenda', 'camera'];
const FEATURED_WEIGHT = 1.4;

/** Posiciona como o grid "dense": cada card no primeiro espaço livre, linha a linha */
function place(slots: Required<Slot>[], rows: number, COLS: number): Placed[] | null {
  const used = Array.from({ length: rows }, () => Array<boolean>(COLS).fill(false));
  const fits = (x: number, y: number, w: number, h: number) => {
    if (x + w > COLS || y + h > rows) return false;
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (used[r]![c]) return false;
    return true;
  };
  const out: Placed[] = [];
  for (const s of slots) {
    let spot: [number, number] | null = null;
    for (let y = 0; y < rows && !spot; y++) for (let x = 0; x < COLS && !spot; x++) if (fits(x, y, s.col, s.row)) spot = [x, y];
    if (!spot) return null;
    const [x, y] = spot;
    for (let r = y; r < y + s.row; r++) for (let c = x; c < x + s.col; c++) used[r]![c] = true;
    out.push({ id: s.id, x, y, w: s.col, h: s.row });
  }
  return out;
}

const area = (slots: Required<Slot>[]) => slots.reduce((n, s) => n + s.col * s.row, 0);

/**
 * Monta a grade do painel a partir dos widgets visíveis: usa só as linhas necessárias
 * (os cards ficam mais altos quando há menos coisas) e, se sobrar espaço, aumenta os
 * widgets prioritários até preencher a tela sem buracos.
 */
export function packLayout(
  visible: Slot[],
  // Layout montado à mão: respeita os tamanhos escolhidos (não cresce sozinho)
  { grow = true } = {},
): { rows: number; cols: number; items: Placed[]; template: string; fits: boolean } {
  let slots = visible.map((s) => ({ id: s.id, col: s.col ?? 1, row: s.row ?? 1 }));
  if (!slots.length) return { rows: 1, cols: BASE_COLS, items: [], template: 'minmax(0,1fr)', fits: true };
  const COLS = area(slots) > BASE_COLS * MAX_ROWS ? WIDE_COLS : BASE_COLS;
  const tallest = Math.max(...slots.map((s) => s.row));
  const rows = Math.min(MAX_ROWS, Math.max(tallest, Math.ceil(area(slots) / COLS)));
  let placed = place(slots, rows, COLS);
  const fits = !!placed;
  if (!placed) {
    // Não coube com os tamanhos do preset: volta tudo para 1×1
    slots = slots.map((s) => ({ ...s, col: 1, row: 1 }));
    placed = place(slots, rows, COLS) ?? [];
  }

  // Cresce enquanto houver espaço livre e alguma opção que ainda encaixe
  const order = [...slots].sort((a, b) => GROW_PRIORITY.indexOf(a.id) - GROW_PRIORITY.indexOf(b.id));
  let grew = true;
  while (grow && grew && area(slots) < rows * COLS) {
    grew = false;
    for (const target of order) {
      const current = slots.find((s) => s.id === target.id)!;
      const options = [
        { ...current, row: current.row + 1 },
        { ...current, col: current.col + 1 },
      ].filter((o) => o.row <= rows && o.col <= 2);
      for (const o of options) {
        const next = slots.map((s) => (s.id === o.id ? o : s));
        const p = place(next, rows, COLS);
        if (p) {
          slots = next;
          placed = p;
          grew = true;
          break;
        }
      }
      if (grew) break;
    }
  }
  const weights = Array.from({ length: rows }, (_, r) =>
    placed.some((p) => FEATURED.includes(p.id) && r >= p.y && r < p.y + p.h) ? FEATURED_WEIGHT : 1,
  );
  // Todas destacadas = todas iguais
  const template = weights.map((w) => `minmax(0,${weights.every((x) => x === w) ? 1 : w}fr)`).join(' ');
  return { rows, cols: COLS, items: placed, template, fits };
}

import { describe, expect, it } from 'vitest';
import { packLayout, type Slot } from './pack';
import { PRESETS, slotsFor } from './registry';

const visible = (preset: keyof typeof PRESETS, hidden: string[]) => PRESETS[preset].filter((s) => !hidden.includes(s.id));
const cells = (r: ReturnType<typeof packLayout>) => r.items.reduce((n, p) => n + p.w * p.h, 0);
const byId = (r: ReturnType<typeof packLayout>, id: string) => r.items.find((p) => p.id === id)!;

describe('grade do painel', () => {
  it('presets completos não cabem em 4×3: viram 5×3 sem buracos', () => {
    for (const k of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
      const r = packLayout(PRESETS[k]);
      expect(r).toMatchObject({ rows: 3, cols: 5 });
      expect(cells(r)).toBe(15);
    }
  });

  it('cabendo em 4×3, continua com 4 colunas', () => {
    const r = packLayout(visible('balanced', ['laundry']));
    expect(r).toMatchObject({ rows: 3, cols: 4 });
    expect(cells(r)).toBe(12);
  });

  it('sem pets e lavanderia (com música): 3 linhas cheias, câmera e agenda no alto', () => {
    const r = packLayout(visible('pets', ['pets', 'laundry']));
    expect(r).toMatchObject({ rows: 3, cols: 4 });
    expect(cells(r)).toBe(12);
    expect(byId(r, 'camera')).toMatchObject({ y: 0, w: 2 });
    expect(byId(r, 'agenda')).toMatchObject({ y: 0, w: 2 });
  });

  it('sem pets, lavanderia e música: 2 linhas cheias, câmera e agenda em destaque', () => {
    const r = packLayout(visible('pets', ['pets', 'laundry', 'music']));
    expect(r.rows).toBe(2);
    expect(cells(r)).toBe(8);
    expect(byId(r, 'camera')).toMatchObject({ y: 0, w: 2 });
    expect(byId(r, 'agenda')).toMatchObject({ y: 0, w: 2 });
    expect(r.template).toBe('minmax(0,1.4fr) minmax(0,1fr)');
  });

  it('espaço que sobra vai para a agenda/câmera', () => {
    const r = packLayout(visible('balanced', ['camera', 'music']));
    expect(cells(r)).toBe(12);
    expect(byId(r, 'agenda').h).toBe(3);
  });

  it('poucos widgets crescem até preencher', () => {
    const r = packLayout([{ id: 'agenda' }, { id: 'camera' }, { id: 'photos' }] as Slot[]);
    expect(r.rows).toBe(1);
    expect(cells(r)).toBe(4);
    expect(byId(r, 'agenda').w).toBe(2);
  });

  it('nunca sobrepõe cards', () => {
    for (const hidden of [[], ['tasks'], ['agenda', 'notes'], ['camera', 'photos', 'laundry'], ['pets']]) {
      const r = packLayout(visible('balanced', hidden));
      const seen = new Set<string>();
      for (const p of r.items)
        for (let y = p.y; y < p.y + p.h; y++)
          for (let x = p.x; x < p.x + p.w; x++) {
            expect(seen.has(`${x},${y}`)).toBe(false);
            seen.add(`${x},${y}`);
          }
    }
  });

  it('layout personalizado respeita os tamanhos escolhidos', () => {
    const layout = {
      preset: 'custom' as const,
      hidden: ['pets' as const, 'laundry' as const],
      custom: { order: ['camera' as const, 'agenda' as const], sizes: { camera: { col: 2, row: 2 }, agenda: { col: 1, row: 3 } } },
    };
    const r = packLayout(slotsFor(layout), { grow: false });
    expect(r.fits).toBe(true);
    expect(byId(r, 'camera')).toMatchObject({ x: 0, y: 0, w: 2, h: 2 });
    expect(byId(r, 'agenda')).toMatchObject({ w: 1, h: 3 });
    // widgets fora da ordem salva entram no fim, 1×1
    expect(byId(r, 'music')).toMatchObject({ w: 1, h: 1 });
  });

  it('avisa quando os tamanhos não cabem', () => {
    const big = (['agenda', 'camera', 'photos', 'pets'] as const).map((id) => ({ id, col: 2, row: 2 }));
    expect(packLayout(big, { grow: false }).fits).toBe(false);
  });
});

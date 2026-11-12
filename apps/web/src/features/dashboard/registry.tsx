import type { DashboardLayout, LayoutPreset, WidgetId } from '@home-hub/shared';
import type { ReactNode } from 'react';
import { AgendaWidget } from '../calendar/AgendaWidgets';
import { CameraWidget } from '../camera/CameraWidget';
import { NotesWidget } from '../notes/NotesWidget';
import { PetsWidget } from '../pets/PetsWidget';
import { PhotosWidget } from '../photos/PhotosWidget';
import { ShoppingWidget } from '../shopping/ShoppingWidget';
import { TasksWidget } from '../tasks/TasksWidget';
import { MusicWidget } from '../music/MusicWidget';
import { LaundryWidget } from './LaundryWidget';
import type { Slot } from './pack';

// Cada widget é independente e autocontido
export const WIDGETS: Record<WidgetId, () => ReactNode> = {
  agenda: () => <AgendaWidget />,
  tasks: () => <TasksWidget />,
  shopping: () => <ShoppingWidget />,
  notes: () => <NotesWidget />,
  pets: () => <PetsWidget />,
  camera: () => <CameraWidget />,
  photos: () => <PhotosWidget />,
  music: () => <MusicWidget />,
  laundry: () => <LaundryWidget />,
};


/**
 * Layouts do painel (grade 4×3 = 12 células; com tudo visível vira 5×3). Widgets ocultos saem da lista e packLayout
 * reorganiza a grade: menos linhas e cards maiores para não sobrar buraco. No celular, uma coluna.
 */
export const PRESETS: Record<Exclude<LayoutPreset, 'custom'>, Slot[]> = {
  // A A T S
  // A A N P
  // C C F L
  balanced: [
    { id: 'agenda', col: 2, row: 2 },
    { id: 'tasks' },
    { id: 'shopping' },
    { id: 'notes' },
    { id: 'pets' },
    { id: 'camera', col: 2 },
    { id: 'photos' },
    { id: 'music' },
    { id: 'laundry' },
  ],
  // A A T S
  // A A T N
  // P C F L
  agenda: [
    { id: 'agenda', col: 2, row: 2 },
    { id: 'tasks', row: 2 },
    { id: 'shopping' },
    { id: 'notes' },
    { id: 'pets' },
    { id: 'camera' },
    { id: 'photos' },
    { id: 'music' },
    { id: 'laundry' },
  ],
  // P P C C
  // P P A A   (agenda larga numa linha)
  // T S N F
  pets: [
    { id: 'pets', col: 2, row: 2 },
    { id: 'camera', col: 2 },
    { id: 'agenda', col: 2 },
    { id: 'tasks' },
    { id: 'shopping' },
    { id: 'notes' },
    { id: 'photos' },
    { id: 'music' },
    { id: 'laundry' },
  ],
};

/** Prioridade no celular: o que se consulta rápido vem primeiro */
export const MOBILE_ORDER: WidgetId[] = ['agenda', 'tasks', 'shopping', 'music', 'notes', 'pets', 'camera', 'photos', 'laundry'];

/** Cards visíveis, na ordem e no tamanho do layout escolhido (pronto ou montado à mão) */
export function slotsFor(layout: DashboardLayout): Slot[] {
  let slots: Slot[];
  if (layout.preset === 'custom' && layout.custom) {
    const { order, sizes } = layout.custom;
    // Widgets novos (que ainda não estavam no layout salvo) entram no fim, no tamanho padrão
    const ids = [...order, ...PRESETS.balanced.map((s) => s.id).filter((id) => !order.includes(id))];
    slots = ids.map((id) => ({ id, ...(sizes[id] ?? { col: 1, row: 1 }) }));
  } else {
    slots = PRESETS[layout.preset === 'custom' ? 'balanced' : layout.preset];
  }
  return slots.filter((s) => !layout.hidden.includes(s.id));
}

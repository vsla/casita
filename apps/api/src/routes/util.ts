import { z } from 'zod';

export const idParam = z.object({ id: z.coerce.number().int().positive() });

/** Itens concluídos continuam visíveis por um dia antes de sumir das listas. */
export const DONE_VISIBLE_MS = 24 * 3_600_000;
export const recentCutoff = () => new Date(Date.now() - DONE_VISIBLE_MS);

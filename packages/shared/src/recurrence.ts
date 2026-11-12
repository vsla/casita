import { z } from 'zod';
import { addDaysISO, daysInMonth, diffDaysISO, formatISODate, parseISODate, weekdayISO, type ISODate } from './dates.ts';

export const recurrenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily'), interval: z.number().int().min(1).max(365) }),
  z.object({
    kind: z.literal('weekly'),
    interval: z.number().int().min(1).max(52),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  }),
  z.object({
    kind: z.literal('monthly'),
    interval: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
]);
export type Recurrence = z.infer<typeof recurrenceSchema>;

const startOfWeekISO = (s: ISODate) => addDaysISO(s, -weekdayISO(s)); // semana começa no domingo

/**
 * Próxima ocorrência estritamente depois de `after`.
 *
 * `anchor` é a data que define a "fase" da recorrência (normalmente o prazo atual
 * da tarefa): "a cada 2 semanas" conta a partir dela. `after` costuma ser
 * max(prazo, data de conclusão) — concluir uma tarefa atrasada não cria uma fila
 * de ocorrências vencidas, apenas agenda a próxima a partir de hoje.
 */
export function nextOccurrence(rule: Recurrence, anchor: ISODate, after: ISODate): ISODate {
  switch (rule.kind) {
    case 'daily': {
      const gap = diffDaysISO(after, anchor);
      const k = gap < 0 ? 0 : Math.floor(gap / rule.interval) + 1;
      return addDaysISO(anchor, k * rule.interval);
    }
    case 'weekly': {
      const anchorWeek = startOfWeekISO(anchor);
      const days = new Set(rule.weekdays);
      // No máximo (interval + 1) semanas de busca
      for (let i = 1; i <= 7 * (rule.interval + 1); i++) {
        const d = addDaysISO(after, i);
        const weeks = diffDaysISO(startOfWeekISO(d), anchorWeek) / 7;
        if (days.has(weekdayISO(d)) && weeks >= 0 && weeks % rule.interval === 0) return d;
      }
      throw new Error('weekly recurrence without match'); // inalcançável com weekdays não vazio
    }
    case 'monthly': {
      const a = parseISODate(anchor);
      const at = (monthsFromAnchor: number) => {
        const y = a.getUTCFullYear();
        const m0 = a.getUTCMonth() + monthsFromAnchor;
        const year = y + Math.floor(m0 / 12);
        const month0 = ((m0 % 12) + 12) % 12;
        // Dia 31 em fevereiro vira o último dia do mês
        const day = Math.min(rule.day, daysInMonth(year, month0));
        return formatISODate(new Date(Date.UTC(year, month0, day)));
      };
      for (let k = 0; k < 1200; k += rule.interval) {
        const d = at(k);
        if (d > after) return d;
      }
      throw new Error('monthly recurrence out of range');
    }
  }
}

/** Próxima data de uma tarefa recorrente quando concluída em `completedOn`. */
export function nextDueAfterCompletion(rule: Recurrence, dueDate: ISODate | null, completedOn: ISODate): ISODate {
  const anchor = dueDate ?? completedOn;
  const after = dueDate && dueDate > completedOn ? dueDate : completedOn;
  return nextOccurrence(rule, anchor, after);
}

const WEEKDAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function describeRecurrence(rule: Recurrence | null | undefined): string {
  if (!rule) return 'Não se repete';
  switch (rule.kind) {
    case 'daily':
      return rule.interval === 1 ? 'Todo dia' : `A cada ${rule.interval} dias`;
    case 'weekly': {
      const days = [...rule.weekdays].sort().map((d) => WEEKDAY_NAMES[d]).join(', ');
      return rule.interval === 1 ? `Toda semana (${days})` : `A cada ${rule.interval} semanas (${days})`;
    }
    case 'monthly':
      return rule.interval === 1 ? `Todo mês, dia ${rule.day}` : `A cada ${rule.interval} meses, dia ${rule.day}`;
  }
}

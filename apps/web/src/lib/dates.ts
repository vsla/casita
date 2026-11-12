import { todayISO as todayInTz, type ISODate } from '@home-hub/shared';

export const todayISO = (timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) => todayInTz(timezone);

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_MIN = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
/** Semana começando na segunda */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
export const dateToISO = (d: Date): ISODate =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const isoToDate = (s: ISODate) => new Date(`${s}T12:00:00`);

export const hhmm = (iso: string | Date) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Hoje, 17:30", "Amanhã, 09:00", "Sex, 10:00", "Em 2 meses" */
export function relativeDateTime(iso: string) {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  if (diff === 0) return `Hoje, ${hhmm(d)}`;
  if (diff === 1) return `Amanhã, ${hhmm(d)}`;
  if (diff === -1) return `Ontem, ${hhmm(d)}`;
  if (diff > 1 && diff < 7) return `${WEEKDAYS_SHORT[d.getDay()]}, ${hhmm(d)}`;
  if (diff >= 30) {
    const months = Math.round(diff / 30);
    return `Em ${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  if (diff >= 7) return `Em ${diff} dias`;
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

/** Prazo de tarefa (data sem hora): "Hoje", "Amanhã", "Atrasada 2 dias", "Qui, 12/11" */
export function dueLabel(due: ISODate | null, timezone?: string): { text: string; tone: 'overdue' | 'today' | 'soon' | 'later' | 'none' } {
  if (!due) return { text: 'Sem prazo', tone: 'none' };
  const diff = Math.round((isoToDate(due).getTime() - isoToDate(todayISO(timezone)).getTime()) / 86_400_000);
  if (diff < 0) return { text: diff === -1 ? 'Atrasada (ontem)' : `Atrasada ${-diff} dias`, tone: 'overdue' };
  if (diff === 0) return { text: 'Hoje', tone: 'today' };
  if (diff === 1) return { text: 'Amanhã', tone: 'soon' };
  const d = isoToDate(due);
  if (diff < 7) return { text: WEEKDAYS_SHORT[d.getDay()]!, tone: 'soon' };
  return { text: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), tone: 'later' };
}

export function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/** Valor para <input type="datetime-local"> */
export const toLocalInput = (d: Date) => `${dateToISO(d)}T${hhmm(d)}`;

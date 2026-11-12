// Datas "de calendário" (YYYY-MM-DD) sem fuso: prazos de tarefa não dependem de hora.
export type ISODate = string;

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function formatISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(s: ISODate, n: number): ISODate {
  const d = parseISODate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return formatISODate(d);
}

export function diffDaysISO(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000);
}

/** 0 = domingo … 6 = sábado */
export function weekdayISO(s: ISODate): number {
  return parseISODate(s).getUTCDay();
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Data de hoje no fuso informado. */
export function todayISO(timeZone = 'America/Sao_Paulo', now = new Date()): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

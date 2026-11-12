// Nuvem · Calendário compartilhado do iCloud (CalDAV, somente leitura).
//
// O iPhone continua sendo a fonte oficial. A cada sincronização lemos os calendários
// escolhidos em Ajustes e gravamos uma cópia em calendar_events (source='icloud').
// O painel lê sempre do banco, então a agenda funciona sem internet.
// Credenciais: ICLOUD_USERNAME + ICLOUD_APP_PASSWORD (senha de app), só no servidor.
import ICAL from 'ical.js';
import { and, eq, gte, lt, notInArray } from 'drizzle-orm';
import { DAVClient, type DAVCalendar } from 'tsdav';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';
import { getIntegration, saveIntegration } from './configStore.js';

const PAST_DAYS = 7;
const FUTURE_DAYS = 90;
const MAX_OCCURRENCES = 500; // proteção contra RRULE sem fim

export function icloudConfigured() {
  return Boolean(config.icloud.username && config.icloud.appPassword);
}

async function client() {
  const c = new DAVClient({
    serverUrl: 'https://caldav.icloud.com',
    credentials: { username: config.icloud.username!, password: config.icloud.appPassword! },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
  try {
    await c.login();
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    throw new Error(/401|unauthor/i.test(msg) ? 'iCloud recusou o login: confira o e-mail do Apple ID e a senha de app' : `Falha ao conectar no iCloud: ${msg}`);
  }
  return c;
}

const nameOf = (c: DAVCalendar) => (typeof c.displayName === 'string' ? c.displayName : 'Sem nome');
// Cores do iCloud vêm como #RRGGBBAA
const colorOf = (c: DAVCalendar) => (c.calendarColor?.match(/^#[0-9a-f]{6}/i)?.[0] ?? '#5fa8a0').toLowerCase();

/** Calendários de eventos disponíveis na conta (inclui os compartilhados aceitos) */
export async function listIcloudCalendars() {
  const c = await client();
  const cals = await c.fetchCalendars();
  return cals
    .filter((cal) => !cal.components || cal.components.includes('VEVENT'))
    .map((cal) => ({ url: cal.url, name: nameOf(cal), color: colorOf(cal) }));
}

type Occurrence = { externalId: string; title: string; description: string | null; location: string | null; startsAt: Date; endsAt: Date | null; allDay: boolean };

/** Lê um VCALENDAR e devolve as ocorrências no intervalo, expandindo recorrências e exceções */
export function expandIcs(ics: string, from: Date, to: Date): Occurrence[] {
  const root = new ICAL.Component(ICAL.parse(ics));
  const vevents = root.getAllSubcomponents('vevent').map((v) => new ICAL.Event(v));
  const masters = vevents.filter((e) => !e.isRecurrenceException());
  for (const ex of vevents.filter((e) => e.isRecurrenceException())) masters.find((m) => m.uid === ex.uid)?.relateException(ex);

  const out: Occurrence[] = [];
  const push = (ev: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null, key: string) => {
    const s = start.toJSDate();
    const e = end?.toJSDate() ?? null;
    if ((e ?? s) < from || s >= to) return;
    out.push({
      externalId: `${ev.uid}|${key}`,
      title: ev.summary || '(sem título)',
      description: ev.description || null,
      location: ev.location || null,
      startsAt: s,
      // Dia inteiro: DTEND é exclusivo no iCal; guardamos o fim no próprio dia
      endsAt: e && start.isDate ? new Date(e.getTime() - 1) : e,
      allDay: start.isDate,
    });
  };

  for (const ev of masters) {
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate, ev.startDate.toString());
      continue;
    }
    const it = ev.iterator();
    const limit = ICAL.Time.fromJSDate(to, true);
    let next: ICAL.Time | null;
    let n = 0;
    while ((next = it.next()) && next.compare(limit) < 0 && n++ < MAX_OCCURRENCES) {
      const occ = ev.getOccurrenceDetails(next);
      push(occ.item, occ.startDate, occ.endDate, occ.recurrenceId.toString());
    }
  }
  return out;
}

export async function syncIcloudCalendar(householdId: number) {
  const cfg = await getIntegration(householdId, 'icloud_calendar');
  if (!icloudConfigured()) return { skipped: true as const };
  const chosen = String(cfg?.settings.calendarUrls ?? '').split('\n').filter(Boolean);

  try {
    const c = await client();
    const all = await c.fetchCalendars();
    // Escolha em Ajustes; sem escolha, usa ICLOUD_CALENDARS (nomes) do .env
    const cals = all.filter((cal) =>
      chosen.length ? chosen.includes(cal.url) : config.icloud.calendars.length ? config.icloud.calendars.includes(nameOf(cal)) : false,
    );
    if (!cals.length) {
      await saveIntegration(householdId, 'icloud_calendar', { lastError: 'Escolha em Ajustes quais calendários mostrar' });
      return { skipped: true as const };
    }

    const from = new Date(Date.now() - PAST_DAYS * 86_400_000);
    const to = new Date(Date.now() + FUTURE_DAYS * 86_400_000);
    const seen: string[] = [];
    for (const cal of cals) {
      const objects = await c.fetchCalendarObjects({ calendar: cal, timeRange: { start: from.toISOString(), end: to.toISOString() } });
      for (const obj of objects) {
        if (typeof obj.data !== 'string') continue;
        let occs: Occurrence[];
        try {
          occs = expandIcs(obj.data, from, to);
        } catch {
          continue; // um evento malformado não derruba a sincronização
        }
        for (const o of occs) {
          seen.push(o.externalId);
          const values = { ...o, color: colorOf(cal), source: 'icloud' as const, householdId };
          await db
            .insert(schema.calendarEvents)
            .values(values)
            .onConflictDoUpdate({ target: [schema.calendarEvents.householdId, schema.calendarEvents.externalId], set: values });
        }
      }
    }
    // Eventos apagados/movidos no iPhone somem do painel
    const e = schema.calendarEvents;
    const removed = await db
      .delete(e)
      .where(
        and(
          eq(e.householdId, householdId),
          eq(e.source, 'icloud'),
          gte(e.startsAt, from),
          lt(e.startsAt, to),
          seen.length ? notInArray(e.externalId, seen) : undefined,
        ),
      )
      .returning({ id: e.id });

    // Com o calendário real conectado, os eventos de exemplo saem
    await db.delete(e).where(and(eq(e.householdId, householdId), eq(e.demo, true)));
    await saveIntegration(householdId, 'icloud_calendar', { lastSyncAt: new Date(), lastError: null });
    return { skipped: false as const, events: seen.length, removed: removed.length, calendars: cals.map(nameOf) };
  } catch (e) {
    await saveIntegration(householdId, 'icloud_calendar', { lastError: (e as Error).message });
    throw e;
  }
}

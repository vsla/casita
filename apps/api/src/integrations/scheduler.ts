import type { FastifyBaseLogger } from 'fastify';
import { db, schema } from '../db/index.js';
import { broadcast } from '../lib/realtime.js';
import { syncIcloudCalendar } from './calendar.js';
import { syncIcloudPhotos } from './icloudPhotos.js';

const CALENDAR_EVERY_MS = 10 * 60_000;
const PHOTOS_EVERY_MS = 30 * 60_000;

/** Sincronizações periódicas. Falhas ficam registradas na integração (lastError) e não param o servidor. */
export function startSyncJobs(log: FastifyBaseLogger) {
  const forEachHousehold = async (fn: (id: number) => Promise<unknown>, entity: 'calendar' | 'photos') => {
    const houses = await db.select({ id: schema.households.id }).from(schema.households);
    for (const h of houses) {
      try {
        const r = (await fn(h.id)) as { skipped?: boolean };
        if (!r?.skipped) broadcast(h.id, entity);
      } catch (e) {
        log.warn({ err: (e as Error).message, entity }, 'sincronização falhou');
      }
    }
  };
  const calendar = () => forEachHousehold(syncIcloudCalendar, 'calendar');
  const photos = () => forEachHousehold(syncIcloudPhotos, 'photos');
  setTimeout(() => {
    calendar();
    photos();
  }, 5000);
  setInterval(calendar, CALENDAR_EVERY_MS).unref();
  setInterval(photos, PHOTOS_EVERY_MS).unref();
}

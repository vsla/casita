import { calendarEventCreateSchema, calendarEventUpdateSchema, calendarRangeSchema } from '@home-hub/shared';
import { and, asc, eq, gte, isNull, lt, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { me } from '../lib/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { broadcast } from '../lib/realtime.js';
import { idParam } from './util.js';

const e = schema.calendarEvents;
const columns = {
  id: e.id,
  title: e.title,
  description: e.description,
  location: e.location,
  startsAt: e.startsAt,
  endsAt: e.endsAt,
  allDay: e.allDay,
  color: e.color,
  icon: e.icon,
  source: e.source,
  demo: e.demo,
};

async function assertEditable(householdId: number, id: number) {
  const [row] = await db.select({ source: e.source }).from(e).where(and(eq(e.id, id), eq(e.householdId, householdId)));
  if (!row) throw notFound('Evento');
  // Eventos do iCloud são cópia somente leitura; edite no iPhone
  if (row.source !== 'local') throw new HttpError(409, 'Evento do iCloud: edite pelo iPhone');
}

export async function calendarRoutes(app: FastifyInstance) {
  // Eventos que se sobrepõem ao intervalo [from, to)
  app.get('/api/calendar', async (request) => {
    const { from, to } = calendarRangeSchema.parse(request.query);
    return db
      .select(columns)
      .from(e)
      .where(
        and(
          eq(e.householdId, me(request).householdId),
          lt(e.startsAt, to),
          or(gte(e.endsAt, from), and(isNull(e.endsAt), gte(e.startsAt, from))),
        ),
      )
      .orderBy(asc(e.startsAt));
  });

  app.post('/api/calendar', async (request, reply) => {
    const m = me(request);
    const body = calendarEventCreateSchema.parse(request.body);
    const [row] = await db
      .insert(e)
      .values({ ...body, householdId: m.householdId })
      .returning(columns);
    broadcast(m.householdId, 'calendar');
    return reply.code(201).send(row);
  });

  app.patch('/api/calendar/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const body = calendarEventUpdateSchema.parse(request.body);
    await assertEditable(m.householdId, id);
    const [row] = await db.update(e).set(body).where(eq(e.id, id)).returning(columns);
    if (row!.endsAt && row!.endsAt < row!.startsAt) throw new HttpError(400, 'O fim deve ser depois do início');
    broadcast(m.householdId, 'calendar');
    return row;
  });

  app.delete('/api/calendar/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    await assertEditable(m.householdId, id);
    await db.delete(e).where(eq(e.id, id));
    broadcast(m.householdId, 'calendar');
    return { ok: true };
  });
}

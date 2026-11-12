import { noteCreateSchema, noteUpdateSchema } from '@home-hub/shared';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { me } from '../lib/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { broadcast } from '../lib/realtime.js';
import { idParam } from './util.js';

const n = schema.notes;
const columns = {
  id: n.id,
  body: n.body,
  pinned: n.pinned,
  expiresAt: n.expiresAt,
  authorId: n.authorId,
  authorName: schema.users.displayName,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
};

async function getNote(householdId: number, id: number) {
  const [row] = await db
    .select(columns)
    .from(n)
    .leftJoin(schema.users, eq(schema.users.id, n.authorId))
    .where(and(eq(n.id, id), eq(n.householdId, householdId)));
  if (!row) throw notFound('Recado');
  return row;
}

export async function noteRoutes(app: FastifyInstance) {
  // Recados vencidos somem automaticamente; fixados primeiro
  app.get('/api/notes', async (request) =>
    db
      .select(columns)
      .from(n)
      .leftJoin(schema.users, eq(schema.users.id, n.authorId))
      .where(and(eq(n.householdId, me(request).householdId), or(isNull(n.expiresAt), gt(n.expiresAt, new Date()))))
      .orderBy(desc(n.pinned), desc(n.createdAt))
      .limit(100),
  );

  app.post('/api/notes', async (request, reply) => {
    const m = me(request);
    const body = noteCreateSchema.parse(request.body);
    if (body.expiresAt && body.expiresAt <= new Date()) throw new HttpError(400, 'A validade precisa ser no futuro');
    const [row] = await db
      .insert(n)
      .values({ ...body, householdId: m.householdId, authorId: m.id })
      .returning({ id: n.id });
    broadcast(m.householdId, 'notes');
    return reply.code(201).send(await getNote(m.householdId, row!.id));
  });

  app.patch('/api/notes/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const body = noteUpdateSchema.parse(request.body);
    const [row] = await db
      .update(n)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(n.id, id), eq(n.householdId, m.householdId)))
      .returning({ id: n.id });
    if (!row) throw notFound('Recado');
    broadcast(m.householdId, 'notes');
    return getNote(m.householdId, id);
  });

  app.delete('/api/notes/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    await db.delete(n).where(and(eq(n.id, id), eq(n.householdId, m.householdId)));
    broadcast(m.householdId, 'notes');
    return { ok: true };
  });
}

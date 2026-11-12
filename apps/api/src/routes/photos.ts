import { photoUpdateSchema } from '@home-hub/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { me } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import { broadcast } from '../lib/realtime.js';
import { deleteUpload, saveUpload } from './files.js';
import { idParam } from './util.js';

const ph = schema.photos;
const view = (r: typeof ph.$inferSelect) => ({
  id: r.id,
  // Demonstrativas apontam para /demo/*.svg do frontend
  url: r.demo ? r.path : `/api/files/${r.path}`,
  caption: r.caption,
  demo: r.demo,
  source: r.source,
  createdAt: r.createdAt,
});

export async function photoRoutes(app: FastifyInstance) {
  app.get('/api/photos', async (request) => {
    const q = z.object({ limit: z.coerce.number().int().max(500).default(100) }).parse(request.query);
    const rows = await db
      .select()
      .from(ph)
      .where(eq(ph.householdId, me(request).householdId))
      .orderBy(desc(sql`coalesce(${ph.takenAt}, ${ph.createdAt})`), desc(ph.id))
      .limit(q.limit);
    return rows.map(view);
  });

  // Aceita várias imagens de uma vez (seleção múltipla no iPhone)
  app.post('/api/photos', async (request, reply) => {
    const m = me(request);
    const created = [];
    for await (const file of request.files()) {
      const saved = await saveUpload(file, 'photos');
      const [row] = await db
        .insert(ph)
        .values({ householdId: m.householdId, path: saved.path, mimeType: saved.mimeType, uploadedById: m.id })
        .returning();
      created.push(view(row!));
    }
    if (created.length) broadcast(m.householdId, 'photos');
    return reply.code(201).send(created);
  });

  app.patch('/api/photos/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const body = photoUpdateSchema.parse(request.body);
    const [row] = await db
      .update(ph)
      .set(body)
      .where(and(eq(ph.id, id), eq(ph.householdId, m.householdId)))
      .returning();
    if (!row) throw notFound('Foto');
    broadcast(m.householdId, 'photos');
    return view(row);
  });

  app.delete('/api/photos/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const [row] = await db
      .delete(ph)
      .where(and(eq(ph.id, id), eq(ph.householdId, m.householdId)))
      .returning();
    if (!row) throw notFound('Foto');
    if (!row.demo) await deleteUpload(row.path);
    broadcast(m.householdId, 'photos');
    return { ok: true };
  });
}

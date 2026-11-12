import { petActivityCreateSchema, petActivityUpdateSchema, petCreateSchema, petUpdateSchema, type PetActivityKind } from '@home-hub/shared';
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { me, requireRole } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import { broadcast } from '../lib/realtime.js';
import { saveUpload } from './files.js';
import { idParam } from './util.js';

const p = schema.pets;
const a = schema.petActivities;

const activityColumns = {
  id: a.id,
  petId: a.petId,
  kind: a.kind,
  notes: a.notes,
  scheduledAt: a.scheduledAt,
  doneAt: a.doneAt,
  doneByName: schema.users.displayName,
  createdAt: a.createdAt,
};

async function assertPet(householdId: number, petId: number) {
  const [pet] = await db.select({ id: p.id }).from(p).where(and(eq(p.id, petId), eq(p.householdId, householdId)));
  if (!pet) throw notFound('Pet');
}

async function assertActivity(householdId: number, activityId: number) {
  const [row] = await db
    .select({ id: a.id })
    .from(a)
    .innerJoin(p, eq(p.id, a.petId))
    .where(and(eq(a.id, activityId), eq(p.householdId, householdId)));
  if (!row) throw notFound('Atividade');
}

const petView = (pet: typeof p.$inferSelect) => {
  const { householdId, photoPath, createdAt, ...rest } = pet;
  return { ...rest, photoUrl: photoPath ? `/api/files/${photoPath}` : null };
};

export async function petRoutes(app: FastifyInstance) {
  app.get('/api/pets', async (request) => {
    const hid = me(request).householdId;
    const pets = await db.select().from(p).where(eq(p.householdId, hid)).orderBy(asc(p.id));
    if (!pets.length) return [];
    const ids = pets.map((x) => x.id);
    const reminders = await db
      .select(activityColumns)
      .from(a)
      .leftJoin(schema.users, eq(schema.users.id, a.doneById))
      .where(and(inArray(a.petId, ids), isNull(a.doneAt), isNotNull(a.scheduledAt)))
      .orderBy(asc(a.scheduledAt));
    const last = await db
      .select({ petId: a.petId, kind: a.kind, at: sql<string>`max(${a.doneAt})` })
      .from(a)
      .where(and(inArray(a.petId, ids), isNotNull(a.doneAt)))
      .groupBy(a.petId, a.kind);
    return pets.map((pet) => ({
      ...petView(pet),
      reminders: reminders.filter((r) => r.petId === pet.id),
      lastByKind: Object.fromEntries(last.filter((l) => l.petId === pet.id).map((l) => [l.kind, new Date(l.at).toISOString()])) as Partial<
        Record<PetActivityKind, string>
      >,
    }));
  });

  app.post('/api/pets', async (request, reply) => {
    const m = requireRole(request, 'admin', 'member');
    const body = petCreateSchema.parse(request.body);
    const [row] = await db.insert(p).values({ ...body, householdId: m.householdId }).returning();
    broadcast(m.householdId, 'pets');
    return reply.code(201).send(petView(row!));
  });

  app.patch('/api/pets/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const body = petUpdateSchema.parse(request.body);
    const [row] = await db
      .update(p)
      .set(body)
      .where(and(eq(p.id, id), eq(p.householdId, m.householdId)))
      .returning();
    if (!row) throw notFound('Pet');
    broadcast(m.householdId, 'pets');
    return petView(row);
  });

  app.delete('/api/pets/:id', async (request) => {
    const m = requireRole(request, 'admin');
    const { id } = idParam.parse(request.params);
    await db.delete(p).where(and(eq(p.id, id), eq(p.householdId, m.householdId)));
    broadcast(m.householdId, 'pets');
    return { ok: true };
  });

  app.post('/api/pets/:id/photo', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    await assertPet(m.householdId, id);
    const file = await request.file();
    if (!file) throw notFound('Arquivo');
    const saved = await saveUpload(file, `pets`);
    const [row] = await db.update(p).set({ photoPath: saved.path }).where(eq(p.id, id)).returning();
    broadcast(m.householdId, 'pets');
    return petView(row!);
  });

  // ---------- Atividades / lembretes ----------
  app.get('/api/pets/:id/activities', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const q = z.object({ limit: z.coerce.number().int().max(200).default(50) }).parse(request.query);
    await assertPet(m.householdId, id);
    return db
      .select(activityColumns)
      .from(a)
      .leftJoin(schema.users, eq(schema.users.id, a.doneById))
      .where(and(eq(a.petId, id), isNotNull(a.doneAt)))
      .orderBy(desc(a.doneAt))
      .limit(q.limit);
  });

  app.post('/api/pets/:id/activities', async (request, reply) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const body = petActivityCreateSchema.parse(request.body);
    await assertPet(m.householdId, id);
    const done = body.done || !body.scheduledAt;
    const [row] = await db
      .insert(a)
      .values({
        petId: id,
        kind: body.kind,
        notes: body.notes ?? null,
        scheduledAt: body.scheduledAt ?? null,
        doneAt: done ? new Date() : null,
        doneById: done ? m.id : null,
      })
      .returning({ id: a.id });
    broadcast(m.householdId, 'pets');
    return reply.code(201).send(row);
  });

  app.patch('/api/pet-activities/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const body = petActivityUpdateSchema.parse(request.body);
    await assertActivity(m.householdId, id);
    const { done, ...rest } = body;
    const patch = { ...rest, ...(done !== undefined ? { doneAt: done ? new Date() : null, doneById: done ? m.id : null } : {}) };
    await db.update(a).set(patch).where(eq(a.id, id));
    broadcast(m.householdId, 'pets');
    return { ok: true };
  });

  app.delete('/api/pet-activities/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    await assertActivity(m.householdId, id);
    await db.delete(a).where(eq(a.id, id));
    broadcast(m.householdId, 'pets');
    return { ok: true };
  });
}

import {
  dashboardLayoutSchema,
  householdUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
  type DashboardLayout,
  type Member,
} from '@home-hub/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { me, requireRole } from '../lib/auth.js';
import { forbidden, HttpError, notFound } from '../lib/errors.js';
import { hashPassword } from '../lib/password.js';
import { broadcast } from '../lib/realtime.js';
import { deleteUpload, saveUpload } from './files.js';
import { idParam } from './util.js';

export const DEFAULT_LAYOUT: DashboardLayout = { preset: 'balanced', hidden: [] };

export async function getHousehold(id: number) {
  const [h] = await db.select().from(schema.households).where(eq(schema.households.id, id));
  if (!h) throw notFound('Casa');
  return h;
}

const memberColumns = {
  id: schema.users.id,
  username: schema.users.username,
  displayName: schema.users.displayName,
  color: schema.users.color,
  photoPath: schema.users.photoPath,
  role: schema.householdMembers.role,
};

function memberResponse({ photoPath, ...member }: Omit<Member, 'photoUrl'> & { photoPath: string | null }): Member {
  return { ...member, photoUrl: photoPath ? `/api/files/${photoPath.replaceAll('\\', '/')}` : null };
}

async function checkPhotoAccess(m: ReturnType<typeof me>, id: number) {
  if (id !== m.id && m.role !== 'admin') throw forbidden();
  const [member] = await db.select({ id: schema.householdMembers.userId })
    .from(schema.householdMembers)
    .where(and(eq(schema.householdMembers.householdId, m.householdId), eq(schema.householdMembers.userId, id)));
  if (!member) throw notFound('Morador');
}

async function replaceMemberPhoto(id: number, path: string | null) {
  const previous = await db.transaction(async (tx) => {
    const [user] = await tx.select({ photoPath: schema.users.photoPath }).from(schema.users)
      .where(eq(schema.users.id, id)).for('update');
    if (!user) throw notFound('Morador');
    await tx.update(schema.users).set({ photoPath: path }).where(eq(schema.users.id, id));
    return user.photoPath;
  });
  if (previous) await deleteUpload(previous);
}

export async function householdRoutes(app: FastifyInstance) {
  // ---------- Casa ----------
  app.get('/api/household', async (request) => {
    const { createdAt, ...h } = await getHousehold(me(request).householdId);
    return h;
  });

  app.patch('/api/household', async (request) => {
    const m = requireRole(request, 'admin');
    const body = householdUpdateSchema.parse(request.body);
    if (Object.keys(body).length) await db.update(schema.households).set(body).where(eq(schema.households.id, m.householdId));
    broadcast(m.householdId, 'household');
    const { createdAt, ...h } = await getHousehold(m.householdId);
    return h;
  });

  // ---------- Moradores ----------
  app.get('/api/members', async (request) =>
    (await db
      .select(memberColumns)
      .from(schema.householdMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.householdMembers.userId))
      .where(eq(schema.householdMembers.householdId, me(request).householdId))
      .orderBy(asc(schema.users.id))).map(memberResponse),
  );

  app.post('/api/members', async (request, reply) => {
    const m = requireRole(request, 'admin');
    const body = userCreateSchema.parse(request.body);
    const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, body.username));
    if (exists) throw new HttpError(409, 'Esse nome de usuário já existe');
    const [user] = await db
      .insert(schema.users)
      .values({ username: body.username, displayName: body.displayName, color: body.color, passwordHash: await hashPassword(body.password) })
      .returning();
    await db.insert(schema.householdMembers).values({ householdId: m.householdId, userId: user!.id, role: body.role });
    broadcast(m.householdId, 'members');
    return reply.code(201).send({ id: user!.id, username: user!.username, displayName: user!.displayName, color: user!.color, role: body.role, photoUrl: null });
  });

  app.post('/api/members/:id/photo', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    await checkPhotoAccess(m, id);
    const file = await request.file();
    if (!file) throw new HttpError(400, 'Selecione uma imagem');
    const { path } = await saveUpload(file, 'members');
    try {
      await replaceMemberPhoto(id, path);
    } catch (error) {
      await deleteUpload(path);
      throw error;
    }
    broadcast(m.householdId, 'members');
    return { ok: true };
  });

  app.delete('/api/members/:id/photo', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    await checkPhotoAccess(m, id);
    await replaceMemberPhoto(id, null);
    broadcast(m.householdId, 'members');
    return { ok: true };
  });

  app.patch('/api/members/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const body = userUpdateSchema.parse(request.body);
    const self = id === m.id;
    // Cada um edita o próprio nome, cor e senha; papel e outros usuários só admin
    if (!self && m.role !== 'admin') throw forbidden();
    if (body.role && m.role !== 'admin') throw forbidden();
    if (self && body.role && body.role !== 'admin') throw new HttpError(400, 'Você não pode remover seu próprio acesso de admin');
    const [member] = await db
      .select()
      .from(schema.householdMembers)
      .where(and(eq(schema.householdMembers.householdId, m.householdId), eq(schema.householdMembers.userId, id)));
    if (!member) throw notFound('Morador');

    const { role, password, ...profile } = body;
    const userPatch = { ...profile, ...(password ? { passwordHash: await hashPassword(password) } : {}) };
    if (Object.keys(userPatch).length) await db.update(schema.users).set(userPatch).where(eq(schema.users.id, id));
    if (role)
      await db
        .update(schema.householdMembers)
        .set({ role })
        .where(and(eq(schema.householdMembers.householdId, m.householdId), eq(schema.householdMembers.userId, id)));
    // Trocar a senha encerra as outras sessões desse usuário
    if (password && !self) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
    broadcast(m.householdId, 'members');
    return { ok: true };
  });

  app.delete('/api/members/:id', async (request) => {
    const m = requireRole(request, 'admin');
    const { id } = idParam.parse(request.params);
    if (id === m.id) throw new HttpError(400, 'Você não pode remover a si mesmo');
    await db
      .delete(schema.householdMembers)
      .where(and(eq(schema.householdMembers.householdId, m.householdId), eq(schema.householdMembers.userId, id)));
    await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, id), eq(schema.sessions.householdId, m.householdId)));
    broadcast(m.householdId, 'members');
    return { ok: true };
  });

  // ---------- Layout do dashboard (por tipo de tela) ----------
  const deviceQuery = z.object({ device: z.enum(['panel', 'mobile']).default('panel') });

  app.get('/api/layout', async (request) => {
    const { device } = deviceQuery.parse(request.query);
    const [row] = await db
      .select()
      .from(schema.dashboardLayouts)
      .where(and(eq(schema.dashboardLayouts.householdId, me(request).householdId), eq(schema.dashboardLayouts.device, device)));
    // Revalida: layouts antigos podem citar widgets que não existem mais
    return dashboardLayoutSchema.safeParse(row?.layout).data ?? DEFAULT_LAYOUT;
  });

  app.put('/api/layout', async (request) => {
    const m = requireRole(request, 'admin', 'member');
    const { device } = deviceQuery.parse(request.query);
    const layout = dashboardLayoutSchema.parse(request.body);
    await db
      .insert(schema.dashboardLayouts)
      .values({ householdId: m.householdId, device, layout })
      .onConflictDoUpdate({
        target: [schema.dashboardLayouts.householdId, schema.dashboardLayouts.device],
        set: { layout, updatedAt: new Date() },
      });
    broadcast(m.householdId, 'layout');
    return layout;
  });
}

import { loginSchema } from '@home-hub/shared';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { createSession, destroySession, me } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { verifyPassword } from '../lib/password.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { username, password } = loginSchema.parse(request.body);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    const valid = user && (await verifyPassword(password, user.passwordHash));
    if (!user || !valid) throw new HttpError(401, 'Usuário ou senha inválidos');
    const [membership] = await db
      .select()
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.userId, user.id))
      .orderBy(asc(schema.householdMembers.createdAt))
      .limit(1);
    if (!membership) throw new HttpError(403, 'Usuário sem casa associada');
    await createSession(request, reply, user.id, membership.householdId);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      color: user.color,
      role: membership.role,
      householdId: membership.householdId,
    };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    await destroySession(request, reply);
    return { ok: true };
  });

  app.get('/api/auth/me', async (request) => me(request));
}

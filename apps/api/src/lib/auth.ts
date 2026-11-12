import { createHash, randomBytes } from 'node:crypto';
import type { Me, MemberRole } from '@home-hub/shared';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';
import { forbidden, HttpError } from './errors.js';

export const SESSION_COOKIE = 'hh_session';
const SESSION_DAYS = 180; // o painel da casa fica logado

declare module 'fastify' {
  interface FastifyRequest {
    me: Me | null;
  }
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(request: FastifyRequest, reply: FastifyReply, userId: number, householdId: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(schema.sessions).values({
    id: hashToken(token),
    userId,
    householdId,
    expiresAt,
    userAgent: request.headers['user-agent']?.slice(0, 200) ?? null,
  });
  // Limpeza oportunista de sessões vencidas
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    expires: expiresAt,
  });
}

export async function destroySession(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[SESSION_COOKIE];
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function meFromToken(token: string | undefined): Promise<Me | null> {
  if (!token) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      color: schema.users.color,
      role: schema.householdMembers.role,
      householdId: schema.sessions.householdId,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .innerJoin(
      schema.householdMembers,
      and(eq(schema.householdMembers.userId, schema.users.id), eq(schema.householdMembers.householdId, schema.sessions.householdId)),
    )
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())));
  return row ?? null;
}

// O retorno do login do Spotify chega sem a sessão (vem por 127.0.0.1); é validado pelo "state" de uso único
const PUBLIC_API = new Set(['/api/auth/login', '/api/health', '/api/integrations/spotify/callback']);

export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('me', null);
  app.addHook('onRequest', async (request) => {
    const path = request.url.split('?')[0]!;
    if (!path.startsWith('/api/') || PUBLIC_API.has(path)) return;
    request.me = await meFromToken(request.cookies[SESSION_COOKIE]);
    if (!request.me) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  });
}

/** Usuário autenticado (as rotas /api já passaram pelo hook). */
export function me(request: FastifyRequest): Me {
  if (!request.me) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  return request.me;
}

export function requireRole(request: FastifyRequest, ...roles: MemberRole[]): Me {
  const m = me(request);
  if (!roles.includes(m.role)) throw forbidden();
  return m;
}

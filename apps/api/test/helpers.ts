import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

export async function makeApp() {
  return buildApp({ logger: false, serveWeb: false });
}

/** Cliente com cookie de sessão de um usuário do seed. */
export async function login(app: FastifyInstance, username = 'demo-admin', password = 'senha-fixture-2026') {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });
  if (res.statusCode !== 200) throw new Error(`login falhou: ${res.statusCode} ${res.body}`);
  const cookie = res.cookies.find((c) => c.name === 'hh_session')!;
  const headers = { cookie: `hh_session=${cookie.value}` };
  const call = async <T = any>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: unknown) => {
    const r = await app.inject({ method, url, headers, payload: payload as any });
    return { status: r.statusCode, body: (r.body ? r.json() : null) as T };
  };
  return { call, headers };
}

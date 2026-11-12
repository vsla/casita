import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let app: FastifyInstance;
let call: Awaited<ReturnType<typeof import('./helpers.js').login>>['call'];

beforeAll(async () => {
  // sem app do Spotify no .env: nada aparece como conectado
  process.env.SPOTIFY_CLIENT_ID = '';
  process.env.SPOTIFY_CLIENT_SECRET = '';
  const { makeApp, login } = await import('./helpers.js');
  app = await makeApp();
  ({ call } = await login(app));
});

afterAll(async () => {
  await app.close();
  (await import('../src/db/index.js')).sql.end();
});

describe('Spotify', () => {
  it('sem credenciais no servidor fica "não configurado"', async () => {
    expect((await call('GET', '/api/spotify')).body).toEqual({ state: 'not_configured' });
  });

  it('comandos exigem login', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/spotify/command', payload: { action: 'pause' } });
    expect(res.statusCode).toBe(401);
  });

  it('retorno do login sem "state" válido não conecta nada', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/integrations/spotify/callback?code=abc&state=forjado' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('expirado');
  });
});

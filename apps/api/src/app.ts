import { existsSync } from 'node:fs';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { config } from './config.js';
import { registerAuth } from './lib/auth.js';
import { registerErrorHandler } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { calendarRoutes } from './routes/calendar.js';
import { fileRoutes } from './routes/files.js';
import { householdRoutes } from './routes/household.js';
import { integrationRoutes } from './routes/integrations.js';
import { noteRoutes } from './routes/notes.js';
import { petRoutes } from './routes/pets.js';
import { photoRoutes } from './routes/photos.js';
import { shoppingRoutes } from './routes/shopping.js';
import { taskRoutes } from './routes/tasks.js';

export async function buildApp(opts: { logger?: boolean; serveWeb?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    trustProxy: true, // atrás do Caddy na VPS
  });

  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 20 } });
  if (config.corsOrigins.length) await app.register(cors, { origin: config.corsOrigins, credentials: true });

  registerErrorHandler(app);
  registerAuth(app);

  app.get('/api/health', async () => ({ ok: true }));
  for (const routes of [
    authRoutes,
    householdRoutes,
    taskRoutes,
    shoppingRoutes,
    noteRoutes,
    petRoutes,
    calendarRoutes,
    photoRoutes,
    fileRoutes,
    integrationRoutes,
  ]) {
    await app.register(routes);
  }

  // Em produção a API serve o build do React (um processo só no PC da casa)
  const serveWeb = opts.serveWeb !== false && existsSync(config.webDist);
  if (serveWeb) await app.register(fastifyStatic, { root: config.webDist, wildcard: false });
  app.setNotFoundHandler((request, reply) =>
    serveWeb && !request.url.startsWith('/api/')
      ? reply.sendFile('index.html')
      : reply.code(404).send({ error: `Rota não encontrada: ${request.url.split('?')[0]}` }),
  );

  return app;
}

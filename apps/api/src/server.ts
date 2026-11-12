import { buildApp } from './app.js';
import { config } from './config.js';
import { sql } from './db/index.js';
import { bootstrap } from './db/bootstrap.js';
import { runMigrations } from './db/migrate.js';
import { startSyncJobs } from './integrations/scheduler.js';
import { attachRealtime } from './lib/realtime.js';

// Migrations no boot: atualizar o PC da casa é só "git pull && pnpm build && restart"
await runMigrations();
await bootstrap();

const app = await buildApp();
attachRealtime(app.server, config.corsOrigins);
await app.listen({ port: config.port, host: config.host });
startSyncJobs(app.log);

// systemd / Docker mandam SIGTERM ao parar o serviço
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
}

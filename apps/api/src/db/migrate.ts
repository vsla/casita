import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './index.js';

export const migrationsFolder = resolve(import.meta.dirname, '../../drizzle');

export async function runMigrations() {
  await migrate(db, { migrationsFolder });
}

if (import.meta.main) {
  runMigrations()
    .then(() => console.log('Migrations aplicadas.'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => sql.end());
}

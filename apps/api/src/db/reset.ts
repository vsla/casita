// Apaga TODO o banco local e recria do zero (migrations + seed). Só para desenvolvimento.
import { config } from '../config.js';
import { sql } from './index.js';
import { runMigrations } from './migrate.js';
import { seed } from './seed.js';

if (config.production) throw new Error('db:reset bloqueado em produção');
if ((process.env.SEED_PASSWORD?.length ?? 0) < 12) {
  throw new Error('Defina SEED_PASSWORD com pelo menos 12 caracteres antes de recriar o banco de demonstração.');
}

await sql.unsafe('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
await runMigrations();
await seed();
await sql.end();
console.log('Banco recriado.');

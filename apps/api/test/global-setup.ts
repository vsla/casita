import { execFileSync } from 'node:child_process';
import postgres from 'postgres';

export async function setup() {
  const url = process.env.DATABASE_URL ?? 'postgres://homehub:homehub@localhost:5432/homehub';
  const admin = postgres(url.replace(/\/[^/]+$/, '/postgres'), { max: 1, onnotice: () => {} });
  await admin.unsafe('drop database if exists homehub_test with (force)');
  await admin.unsafe('create database homehub_test');
  await admin.end();
  // Migrations + seed num processo separado, com o env de teste
  const testUrl = url.replace(/\/[^/]+$/, '/homehub_test');
  const env = { ...process.env, DATABASE_URL: testUrl, SEED_USERS: 'demo-admin:Pessoa A:#6f9a85,demo-member:Pessoa B:#d9925b', SEED_PASSWORD: 'senha-fixture-2026' };
  execFileSync('tsx', ['src/db/migrate.ts'], { env, stdio: 'inherit' });
  execFileSync('tsx', ['src/db/seed.ts'], { env, stdio: 'ignore' });
}

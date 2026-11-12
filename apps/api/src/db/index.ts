import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.js';
import * as schema from './schema.js';

export const sql = postgres(config.databaseUrl, { max: 5, onnotice: () => {} });
export const db = drizzle(sql, { schema });
export type DB = typeof db;
export { schema };

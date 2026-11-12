import { householdUpdateSchema, userCreateSchema } from '@home-hub/shared';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../lib/password.js';
import { db, schema } from './index.js';

/** Cria a primeira casa e o administrador somente em um banco vazio. */
export async function bootstrap() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(81623019)`);
    if ((await tx.select({ id: schema.households.id }).from(schema.households).limit(1)).length) return;
    if ((await tx.select({ id: schema.users.id }).from(schema.users).limit(1)).length) {
      throw new Error('O banco contém usuários sem uma casa. Use um banco vazio para a primeira instalação.');
    }

    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!password || password.length < 12) {
      throw new Error('Defina BOOTSTRAP_ADMIN_PASSWORD no .env com pelo menos 12 caracteres para criar a primeira casa.');
    }
    const user = userCreateSchema.safeParse({
      username: process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'admin',
      displayName: process.env.BOOTSTRAP_ADMIN_NAME ?? 'Administrador',
      password,
      role: 'admin',
    });
    const house = householdUpdateSchema.safeParse({
      name: process.env.BOOTSTRAP_HOUSE_NAME ?? 'Minha casa',
      timezone: process.env.BOOTSTRAP_HOUSE_TIMEZONE ?? 'America/Sao_Paulo',
    });
    if (!user.success || !house.success || !house.data.name) {
      throw new Error('Confira o nome da casa, o fuso e os dados do administrador nas variáveis BOOTSTRAP_ do .env.');
    }
    const [createdHouse] = await tx.insert(schema.households).values({
      ...house.data,
      name: house.data.name,
      weatherEnabled: false,
    }).returning({ id: schema.households.id });
    const [createdUser] = await tx.insert(schema.users).values({
      username: user.data.username,
      displayName: user.data.displayName,
      color: user.data.color,
      passwordHash: await hashPassword(user.data.password),
    }).returning({ id: schema.users.id });
    await tx.insert(schema.householdMembers).values({
      householdId: createdHouse!.id,
      userId: createdUser!.id,
      role: 'admin',
    });
  });
}

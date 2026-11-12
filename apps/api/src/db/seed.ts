// Dados DEMONSTRATIVOS para o primeiro uso. Idempotente: só preenche o que está vazio.
// Tudo que é exemplo está marcado (demo=true ou texto "(exemplo)") para ser apagado depois.
import { todayISO, addDaysISO } from '@home-hub/shared';
import { eq, sql as dsql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db, schema, sql } from './index.js';
import { hashPassword } from '../lib/password.js';

const TZ = 'America/Sao_Paulo';

export async function seed() {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12) throw new Error('Defina SEED_PASSWORD com pelo menos 12 caracteres para a demonstração.');
  // formato: usuario:Nome:#cor — o primeiro vira admin
  const people = (process.env.SEED_USERS ?? 'demo-admin:Pessoa A:#6f9a85,demo-member:Pessoa B:#d9925b')
    .split(',')
    .map((s) => s.split(':'))
    .map(([username, displayName, color]) => ({ username: username!, displayName: displayName!, color: color ?? '#6f9a85' }));

  if (people.length < 2) throw new Error('A demonstração precisa de dois usuários fictícios em SEED_USERS.');

  let [house] = await db.select().from(schema.households).limit(1);
  if (!house) {
    [house] = await db
      .insert(schema.households)
      .values({
        name: 'Casa de demonstração',
        subtitle: 'Dados fictícios para explorar o painel',
        weatherEnabled: false,
        timezone: TZ,
      })
      .returning();
  }
  const hid = house!.id;

  const hash = await hashPassword(password);
  const accounts = [
    ...people.map((p, i) => ({ ...p, role: i === 0 ? ('admin' as const) : ('member' as const) })),
    { username: 'casa', displayName: 'Painel da casa', color: '#8a9a8e', role: 'kiosk' as const },
  ];
  for (const acc of accounts) {
    let [user] = await db.select().from(schema.users).where(eq(schema.users.username, acc.username));
    if (!user) {
      [user] = await db
        .insert(schema.users)
        .values({ username: acc.username, displayName: acc.displayName, color: acc.color, passwordHash: hash })
        .returning();
    }
    await db.insert(schema.householdMembers).values({ householdId: hid, userId: user!.id, role: acc.role }).onConflictDoNothing();
  }
  const users = await db.select().from(schema.users);
  const [u1, u2] = people.map((p) => users.find((u) => u.username === p.username)!);

  const isEmpty = async (table: PgTable) => (await db.select({ n: dsql<number>`count(*)::int` }).from(table))[0]!.n === 0;
  const today = todayISO(TZ);
  // Horários fictícios de demonstração (UTC−3)
  const at = (days: number, h: number, m = 0) => new Date(`${addDaysISO(today, days)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`);

  if (await isEmpty(schema.pets)) {
    const [pipoca, nuvem] = await db
      .insert(schema.pets)
      .values([
        { householdId: hid, name: 'Pipoca', species: 'dog', status: 'Em treinamento', notes: 'Treino de "fica" e "junto" (exemplo).' },
        { householdId: hid, name: 'Nuvem', species: 'dog', status: 'Bem' },
      ])
      .returning();
    await db.insert(schema.petActivities).values([
      { petId: pipoca!.id, kind: 'feeding', doneAt: at(0, 7, 30), doneById: u1!.id },
      { petId: nuvem!.id, kind: 'feeding', doneAt: at(0, 7, 35), doneById: u1!.id },
      { petId: pipoca!.id, kind: 'walk', scheduledAt: at(0, 17, 30) },
      { petId: pipoca!.id, kind: 'training', notes: '15 min de "fica" (exemplo)', scheduledAt: at(1, 9) },
      { petId: nuvem!.id, kind: 'bath', scheduledAt: at(3, 10) },
      { petId: nuvem!.id, kind: 'vaccine', notes: 'V10 (exemplo)', scheduledAt: at(45, 10) },
    ]);
  }

  if (await isEmpty(schema.tasks)) {
    const pets = await db.select().from(schema.pets).where(eq(schema.pets.householdId, hid));
    const pipoca = pets.find((p) => p.name === 'Pipoca');
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    await db.insert(schema.tasks).values([
      { householdId: hid, title: 'Lavar roupa', assigneeId: u2!.id, dueDate: today, recurrence: { kind: 'weekly', interval: 1, weekdays: [dow, (dow + 3) % 7] } },
      { householdId: hid, title: 'Limpar cozinha', assigneeId: u1!.id, dueDate: today, recurrence: { kind: 'daily', interval: 1 } },
      { householdId: hid, title: 'Comprar ração', petId: pipoca?.id, assigneeId: null, dueDate: addDaysISO(today, 2) },
      { householdId: hid, title: 'Trocar roupa de cama', assigneeId: u2!.id, dueDate: addDaysISO(today, 4), recurrence: { kind: 'weekly', interval: 2, weekdays: [(dow + 4) % 7] } },
      { householdId: hid, title: 'Pagar internet', assigneeId: u1!.id, dueDate: addDaysISO(today, 6), recurrence: { kind: 'monthly', interval: 1, day: Number(addDaysISO(today, 6).slice(8)) } },
      { householdId: hid, title: 'Organizar a sala', assigneeId: null },
    ]);
  }

  if (await isEmpty(schema.calendarEvents)) {
    await db.insert(schema.calendarEvents).values(
      [
        { title: 'Treino (academia)', startsAt: at(0, 18, 30), endsAt: at(0, 19, 30), color: '#5fa8a0', icon: 'dumbbell' },
        { title: 'Vôlei', startsAt: at(0, 21), endsAt: at(0, 22), color: '#a78bc9', icon: 'volleyball' },
        { title: 'Adestrador do Pipoca', startsAt: at(1, 9), endsAt: at(1, 10), color: '#d9925b', icon: 'paw' },
        { title: 'Compras do mês', startsAt: at(2, 9), endsAt: at(2, 10), color: '#5fa8a0', icon: 'cart' },
        { title: 'Jantar com amigos', startsAt: at(3, 20), endsAt: at(3, 23), color: '#7bb36e', icon: 'utensils' },
        { title: 'Passeio ao ar livre', startsAt: at(5, 8), endsAt: at(5, 12), color: '#5fa8a0', icon: 'sun' },
        { title: 'Aniversário (exemplo)', startsAt: at(9, 0), allDay: true, color: '#d9925b', icon: 'cake' },
      ].map((ev) => ({ ...ev, householdId: hid, demo: true })),
    );
  }

  if (await isEmpty(schema.shoppingItems)) {
    await db.insert(schema.shoppingItems).values(
      [
        { name: 'Leite', quantity: '2 L', category: 'laticinios' as const },
        { name: 'Pão', category: 'padaria' as const },
        { name: 'Bananas', quantity: '1 cacho', category: 'hortifruti' as const },
        { name: 'Detergente', category: 'limpeza' as const },
        { name: 'Ração', quantity: '10 kg', category: 'pets' as const },
      ].map((i) => ({ ...i, householdId: hid, createdById: u1!.id })),
    );
    // Histórico para as sugestões de adição rápida
    await db.insert(schema.shoppingItems).values(
      ['Café', 'Ovos', 'Papel higiênico', 'Arroz'].map((name, i) => ({
        householdId: hid,
        name,
        category: (['mercearia', 'mercearia', 'higiene', 'mercearia'] as const)[i]!,
        checked: true,
        checkedAt: new Date(0),
      })),
    );
  }

  if (await isEmpty(schema.notes)) {
    await db.insert(schema.notes).values([
      { householdId: hid, body: 'Não esquecer de tirar a roupa da máquina ❤️', authorId: u2!.id, pinned: true },
      { householdId: hid, body: 'O técnico da internet vem amanhã de manhã.', authorId: u1!.id, expiresAt: at(2, 0) },
      { householdId: hid, body: 'Separar os documentos da viagem.', authorId: u2!.id },
    ]);
  }

  if (await isEmpty(schema.photos)) {
    await db.insert(schema.photos).values(
      ['beach', 'sunset', 'lake', 'field', 'mountains'].map((n) => ({
        householdId: hid,
        path: `/demo/${n}.svg`,
        mimeType: 'image/svg+xml',
        caption: 'Imagem demonstrativa',
        demo: true,
      })),
    );
  }

  console.log('Dados demonstrativos inseridos.');
}

if (import.meta.main) {
  seed()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => sql.end());
}

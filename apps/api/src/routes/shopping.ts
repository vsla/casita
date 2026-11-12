import { shoppingCreateSchema, shoppingUpdateSchema } from '@home-hub/shared';
import { and, asc, desc, eq, gte, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { me } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import { broadcast } from '../lib/realtime.js';
import { idParam, recentCutoff } from './util.js';

const columns = {
  id: schema.shoppingItems.id,
  name: schema.shoppingItems.name,
  quantity: schema.shoppingItems.quantity,
  category: schema.shoppingItems.category,
  checked: schema.shoppingItems.checked,
  checkedAt: schema.shoppingItems.checkedAt,
  createdAt: schema.shoppingItems.createdAt,
};

export async function shoppingRoutes(app: FastifyInstance) {
  const s = schema.shoppingItems;

  app.get('/api/shopping', async (request) =>
    db
      .select(columns)
      .from(s)
      .where(and(eq(s.householdId, me(request).householdId), or(eq(s.checked, false), gte(s.checkedAt, recentCutoff()))))
      .orderBy(asc(s.checked), asc(s.category), asc(s.name)),
  );

  // "Adição rápida": itens comprados com frequência que não estão na lista agora
  app.get('/api/shopping/suggestions', async (request) => {
    const hid = me(request).householdId;
    return db
      .select({
        name: sql<string>`min(${s.name})`,
        category: sql<string>`mode() within group (order by ${s.category})`,
        count: sql<number>`count(*)::int`,
      })
      .from(s)
      .where(eq(s.householdId, hid))
      .groupBy(sql`lower(${s.name})`)
      .having(sql`bool_and(${s.checked})`)
      .orderBy(desc(sql`count(*)`), sql`min(${s.name})`)
      .limit(12);
  });

  app.post('/api/shopping', async (request, reply) => {
    const m = me(request);
    const body = shoppingCreateSchema.parse(request.body);
    // Se o item já está pendente, atualiza a quantidade em vez de duplicar
    const [existing] = await db
      .select(columns)
      .from(s)
      .where(and(eq(s.householdId, m.householdId), eq(s.checked, false), sql`lower(${s.name}) = lower(${body.name})`));
    if (existing) {
      if (body.quantity && body.quantity !== existing.quantity) {
        const [row] = await db.update(s).set({ quantity: body.quantity }).where(eq(s.id, existing.id)).returning(columns);
        broadcast(m.householdId, 'shopping');
        return row;
      }
      return existing;
    }
    const [row] = await db
      .insert(s)
      .values({ ...body, householdId: m.householdId, createdById: m.id })
      .returning(columns);
    broadcast(m.householdId, 'shopping');
    return reply.code(201).send(row);
  });

  app.patch('/api/shopping/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const body = shoppingUpdateSchema.parse(request.body);
    const patch = { ...body, ...(body.checked !== undefined ? { checkedAt: body.checked ? new Date() : null } : {}) };
    const [row] = await db
      .update(s)
      .set(patch)
      .where(and(eq(s.id, id), eq(s.householdId, m.householdId)))
      .returning(columns);
    if (!row) throw notFound('Item');
    broadcast(m.householdId, 'shopping');
    return row;
  });

  app.delete('/api/shopping/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    await db.delete(s).where(and(eq(s.id, id), eq(s.householdId, m.householdId)));
    broadcast(m.householdId, 'shopping');
    return { ok: true };
  });

  // Remove da lista todos os itens já marcados (depois da compra)
  app.post('/api/shopping/clear-checked', async (request) => {
    const m = me(request);
    // Mantém o histórico para sugestões: só some da lista visível
    await db
      .update(s)
      .set({ checkedAt: new Date(0) })
      .where(and(eq(s.householdId, m.householdId), eq(s.checked, true)));
    broadcast(m.householdId, 'shopping');
    return { ok: true };
  });
}

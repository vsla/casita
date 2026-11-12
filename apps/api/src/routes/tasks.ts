import { taskCompleteSchema, taskCreateSchema, taskUpdateSchema } from '@home-hub/shared';
import { and, asc, desc, eq, gte, isNull, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { me } from '../lib/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { broadcast } from '../lib/realtime.js';
import { completeTask, undoLastCompletion } from '../services/tasks.js';
import { getHousehold } from './household.js';
import { idParam, recentCutoff } from './util.js';

const columns = {
  id: schema.tasks.id,
  title: schema.tasks.title,
  description: schema.tasks.description,
  assigneeId: schema.tasks.assigneeId,
  petId: schema.tasks.petId,
  dueDate: schema.tasks.dueDate,
  recurrence: schema.tasks.recurrence,
  completedAt: schema.tasks.completedAt,
  lastCompletedAt: schema.tasks.lastCompletedAt,
  createdAt: schema.tasks.createdAt,
};

export async function taskRoutes(app: FastifyInstance) {
  app.get('/api/tasks', async (request) => {
    const m = me(request);
    const q = z
      .object({ assignee: z.enum(['me', 'all']).default('all'), includeDone: z.coerce.boolean().default(false) })
      .parse(request.query);
    const t = schema.tasks;
    return db
      .select(columns)
      .from(t)
      .where(
        and(
          eq(t.householdId, m.householdId),
          isNull(t.archivedAt),
          q.includeDone ? undefined : or(isNull(t.completedAt), gte(t.completedAt, recentCutoff())),
          // "Minhas" inclui as atribuídas a "Todos"
          q.assignee === 'me' ? or(eq(t.assigneeId, m.id), isNull(t.assigneeId)) : undefined,
        ),
      )
      // Abertas primeiro, depois por prazo (sem prazo no fim)
      .orderBy(sql`${t.completedAt} is not null`, sql`${t.dueDate} asc nulls last`, asc(t.id));
  });

  app.post('/api/tasks', async (request, reply) => {
    const m = me(request);
    const body = taskCreateSchema.parse(request.body);
    if (body.recurrence && !body.dueDate) throw new HttpError(400, 'Tarefas recorrentes precisam de uma data inicial');
    const [row] = await db
      .insert(schema.tasks)
      .values({ ...body, householdId: m.householdId, createdById: m.id })
      .returning(columns);
    broadcast(m.householdId, 'tasks');
    return reply.code(201).send(row);
  });

  app.patch('/api/tasks/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const body = taskUpdateSchema.parse(request.body);
    const [row] = await db
      .update(schema.tasks)
      .set(body)
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.householdId, m.householdId)))
      .returning(columns);
    if (!row) throw notFound('Tarefa');
    if (row.recurrence && !row.dueDate) throw new HttpError(400, 'Tarefas recorrentes precisam de uma data inicial');
    broadcast(m.householdId, 'tasks');
    return row;
  });

  app.post('/api/tasks/:id/complete', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const { undo } = taskCompleteSchema.parse(request.body ?? {});
    const { timezone } = await getHousehold(m.householdId);
    const ctx = { householdId: m.householdId, userId: m.id, timezone };
    const row = undo ? await undoLastCompletion(id, ctx) : await completeTask(id, ctx);
    broadcast(m.householdId, 'tasks');
    return row;
  });

  // Arquivar em vez de apagar: o histórico de conclusões continua consultável
  app.delete('/api/tasks/:id', async (request) => {
    const m = me(request);
    const { id } = idParam.parse(request.params);
    const [row] = await db
      .update(schema.tasks)
      .set({ archivedAt: new Date() })
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.householdId, m.householdId)))
      .returning({ id: schema.tasks.id });
    if (!row) throw notFound('Tarefa');
    broadcast(m.householdId, 'tasks');
    return { ok: true };
  });

  app.get('/api/tasks/history', async (request) => {
    const m = me(request);
    const q = z.object({ taskId: z.coerce.number().int().optional(), limit: z.coerce.number().int().max(200).default(50) }).parse(request.query);
    return db
      .select({
        id: schema.taskCompletions.id,
        taskId: schema.taskCompletions.taskId,
        taskTitle: schema.tasks.title,
        userId: schema.taskCompletions.userId,
        userName: schema.users.displayName,
        dueDate: schema.taskCompletions.dueDate,
        completedAt: schema.taskCompletions.completedAt,
      })
      .from(schema.taskCompletions)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskCompletions.taskId))
      .leftJoin(schema.users, eq(schema.users.id, schema.taskCompletions.userId))
      .where(and(eq(schema.tasks.householdId, m.householdId), q.taskId ? eq(schema.tasks.id, q.taskId) : undefined))
      .orderBy(desc(schema.taskCompletions.completedAt))
      .limit(q.limit);
  });
}

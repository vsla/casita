import { nextDueAfterCompletion, todayISO } from '@home-hub/shared';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { HttpError, notFound } from '../lib/errors.js';

type Ctx = { householdId: number; userId: number; timezone: string; now?: Date };

async function findTask(householdId: number, taskId: number) {
  const [task] = await db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.householdId, householdId)));
  if (!task) throw notFound('Tarefa');
  return task;
}

/**
 * Concluir: registra no histórico. Tarefa avulsa fica concluída;
 * recorrente é reagendada para a próxima ocorrência e continua aberta.
 */
export async function completeTask(taskId: number, ctx: Ctx) {
  const now = ctx.now ?? new Date();
  return db.transaction(async (tx) => {
    const task = await findTask(ctx.householdId, taskId);
    if (task.completedAt) throw new HttpError(409, 'Tarefa já concluída');
    await tx.insert(schema.taskCompletions).values({ taskId, userId: ctx.userId, dueDate: task.dueDate, completedAt: now });
    const patch = task.recurrence
      ? { dueDate: nextDueAfterCompletion(task.recurrence, task.dueDate, todayISO(ctx.timezone, now)), lastCompletedAt: now }
      : { completedAt: now, lastCompletedAt: now };
    const [updated] = await tx.update(schema.tasks).set(patch).where(eq(schema.tasks.id, taskId)).returning();
    return updated!;
  });
}

/** Desfaz a última conclusão (toque acidental no painel). */
export async function undoLastCompletion(taskId: number, ctx: Ctx) {
  return db.transaction(async (tx) => {
    const task = await findTask(ctx.householdId, taskId);
    const [last, previous] = await tx
      .select()
      .from(schema.taskCompletions)
      .where(eq(schema.taskCompletions.taskId, taskId))
      .orderBy(desc(schema.taskCompletions.completedAt), desc(schema.taskCompletions.id))
      .limit(2);
    if (!last) throw new HttpError(409, 'Nada para desfazer');
    await tx.delete(schema.taskCompletions).where(eq(schema.taskCompletions.id, last.id));
    const patch = task.recurrence
      ? { dueDate: last.dueDate, lastCompletedAt: previous?.completedAt ?? null }
      : { completedAt: null, lastCompletedAt: previous?.completedAt ?? null };
    const [updated] = await tx.update(schema.tasks).set(patch).where(eq(schema.tasks.id, taskId)).returning();
    return updated!;
  });
}

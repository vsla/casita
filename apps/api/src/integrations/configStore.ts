import type { IntegrationKind } from '@home-hub/shared';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export type IntegrationRow = typeof schema.integrationConfigs.$inferSelect;

export async function getIntegration(householdId: number, kind: IntegrationKind): Promise<IntegrationRow | null> {
  const [row] = await db
    .select()
    .from(schema.integrationConfigs)
    .where(and(eq(schema.integrationConfigs.householdId, householdId), eq(schema.integrationConfigs.kind, kind)));
  return row ?? null;
}

export async function saveIntegration(
  householdId: number,
  kind: IntegrationKind,
  patch: Partial<Pick<IntegrationRow, 'enabled' | 'settings' | 'lastSyncAt' | 'lastError'>>,
) {
  const now = new Date();
  await db
    .insert(schema.integrationConfigs)
    .values({ householdId, kind, enabled: false, settings: {}, ...patch, updatedAt: now })
    .onConflictDoUpdate({
      target: [schema.integrationConfigs.householdId, schema.integrationConfigs.kind],
      set: { ...patch, updatedAt: now },
    });
}

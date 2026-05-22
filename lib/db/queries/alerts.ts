import "server-only";
import { db, schema } from "../client";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function createOwnerAlert(input: {
  tenantId: string;
  type: string;
  entityType: string;
  entityId: string;
  dealerId: string | null;
  message: string;
}): Promise<void> {
  await db.insert(schema.ownerAlerts).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    dealerId: input.dealerId,
    message: input.message,
    isRead: false,
  });
}

export async function listOwnerAlerts(tenantId: string, unreadOnly = false) {
  const where = [eq(schema.ownerAlerts.tenantId, tenantId)];
  if (unreadOnly) where.push(eq(schema.ownerAlerts.isRead, false));
  return db
    .select()
    .from(schema.ownerAlerts)
    .where(and(...where))
    .orderBy(desc(schema.ownerAlerts.createdAt))
    .limit(100);
}

export async function countUnreadAlerts(tenantId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.ownerAlerts)
    .where(and(eq(schema.ownerAlerts.tenantId, tenantId), eq(schema.ownerAlerts.isRead, false)));
  return Number(n);
}

export async function markAlertRead(id: string): Promise<void> {
  await db.update(schema.ownerAlerts).set({ isRead: true }).where(eq(schema.ownerAlerts.id, id));
}

export async function markAllAlertsRead(tenantId: string): Promise<void> {
  await db
    .update(schema.ownerAlerts)
    .set({ isRead: true })
    .where(and(eq(schema.ownerAlerts.tenantId, tenantId), eq(schema.ownerAlerts.isRead, false)));
}

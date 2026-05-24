import "server-only";
import { randomUUID } from "node:crypto";
import { db, schema } from "@/lib/db/client";
import { and, desc, eq, lt } from "drizzle-orm";
import { format, subDays } from "date-fns";

async function buildBackupData(tenantId: string) {
  const [
    activations,
    purchases,
    dealerIds,
    dealerIncentivePolicies,
    activationIncentivePolicies,
    targetBonusPolicies,
    stockInPolicies,
    interIdTransfers,
  ] = await Promise.all([
    db.select().from(schema.activations).where(eq(schema.activations.tenantId, tenantId)),
    db.select().from(schema.purchases).where(eq(schema.purchases.tenantId, tenantId)),
    db.select().from(schema.dealerIds).where(eq(schema.dealerIds.tenantId, tenantId)),
    db.select().from(schema.dealerIncentivePolicies).where(eq(schema.dealerIncentivePolicies.tenantId, tenantId)),
    db.select().from(schema.activationIncentivePolicies).where(eq(schema.activationIncentivePolicies.tenantId, tenantId)),
    db.select().from(schema.targetBonusPolicies).where(eq(schema.targetBonusPolicies.tenantId, tenantId)),
    db.select().from(schema.stockInPolicies).where(eq(schema.stockInPolicies.tenantId, tenantId)),
    db.select().from(schema.interIdTransfers).where(eq(schema.interIdTransfers.tenantId, tenantId)),
  ]);

  return {
    backedUpAt: new Date().toISOString(),
    activations,
    purchases,
    dealerIds,
    policies: {
      dealerIncentivePolicies,
      activationIncentivePolicies,
      targetBonusPolicies,
      stockInPolicies,
    },
    interIdTransfers,
  };
}

export async function ensureTodayBackup(tenantId: string): Promise<void> {
  const today = format(new Date(), "yyyy-MM-dd");

  const existing = await db
    .select({ id: schema.dealerDailyBackups.id })
    .from(schema.dealerDailyBackups)
    .where(
      and(
        eq(schema.dealerDailyBackups.tenantId, tenantId),
        eq(schema.dealerDailyBackups.backupDate, today),
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  const data = await buildBackupData(tenantId);

  await db.insert(schema.dealerDailyBackups).values({
    id: randomUUID(),
    tenantId,
    backupDate: today,
    data: JSON.stringify(data),
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing();

  // Prune: keep only today and yesterday
  const dayBeforeYesterday = format(subDays(new Date(), 2), "yyyy-MM-dd");
  await db
    .delete(schema.dealerDailyBackups)
    .where(
      and(
        eq(schema.dealerDailyBackups.tenantId, tenantId),
        lt(schema.dealerDailyBackups.backupDate, dayBeforeYesterday),
      ),
    );
}

export async function listDealerBackups(tenantId: string) {
  return db
    .select({
      id: schema.dealerDailyBackups.id,
      backupDate: schema.dealerDailyBackups.backupDate,
      createdAt: schema.dealerDailyBackups.createdAt,
    })
    .from(schema.dealerDailyBackups)
    .where(eq(schema.dealerDailyBackups.tenantId, tenantId))
    .orderBy(desc(schema.dealerDailyBackups.backupDate))
    .limit(2);
}

export async function getBackupById(id: string): Promise<unknown | null> {
  const rows = await db
    .select({ data: schema.dealerDailyBackups.data, tenantId: schema.dealerDailyBackups.tenantId, backupDate: schema.dealerDailyBackups.backupDate })
    .from(schema.dealerDailyBackups)
    .where(eq(schema.dealerDailyBackups.id, id))
    .limit(1);

  if (rows.length === 0) return null;
  return { ...JSON.parse(rows[0].data), tenantId: rows[0].tenantId, backupDate: rows[0].backupDate };
}

"use server";

import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { db, schema } from "@/lib/db/client";
import { and, count, eq, gte, lte } from "drizzle-orm";
import { format, startOfMonth, endOfMonth } from "date-fns";

export type DealerDashboardStats = {
  todayActivations: number;
  monthActivations: number;
  purchaseRecords: number;
  dealerName: string | null;
};

export async function getDealerDashboardStats(): Promise<DealerDashboardStats> {
  const session = await getDealerSession();
  if (!session) throw new Error("Unauthorized");

  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);

  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  let todayActivations = 0;
  let monthActivations = 0;
  let purchaseRecords = 0;
  let dealerName: string | null = null;

  if (dealerId) {
    const [todayRows, monthRows, purchaseRows, dealerRows] = await Promise.all([
      db.select({ c: count() }).from(schema.activations).where(
        and(
          eq(schema.activations.tenantId, tenantId),
          eq(schema.activations.dealerId, dealerId),
          eq(schema.activations.activationDate, today),
        ),
      ),
      db.select({ c: count() }).from(schema.activations).where(
        and(
          eq(schema.activations.tenantId, tenantId),
          eq(schema.activations.dealerId, dealerId),
          gte(schema.activations.activationDate, monthStart),
          lte(schema.activations.activationDate, monthEnd),
        ),
      ),
      db.select({ c: count() }).from(schema.purchases).where(
        and(
          eq(schema.purchases.tenantId, tenantId),
          eq(schema.purchases.dealerId, dealerId),
        ),
      ),
      db.select({ name: schema.dealerIds.name }).from(schema.dealerIds).where(
        and(
          eq(schema.dealerIds.tenantId, tenantId),
          eq(schema.dealerIds.id, dealerId),
        ),
      ).limit(1),
    ]);

    todayActivations = todayRows[0]?.c ?? 0;
    monthActivations = monthRows[0]?.c ?? 0;
    purchaseRecords = purchaseRows[0]?.c ?? 0;
    dealerName = dealerRows[0]?.name ?? null;
  }

  return { todayActivations, monthActivations, purchaseRecords, dealerName };
}

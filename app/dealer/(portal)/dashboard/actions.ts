"use server";

import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { db, schema } from "@/lib/db/client";
import { and, asc, count, eq, gte, lte, sql } from "drizzle-orm";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { countPendingCrossRegion, listPendingInbound } from "@/lib/db/queries/transfers";
import type { StockRow } from "@/lib/db/queries/purchases";

export interface ModelSaleRow {
  modelId: string;
  modelName: string;
  qty: number;
}

export async function dealerGetModelSalesAction(from: string, to: string): Promise<ModelSaleRow[]> {
  const session = await getDealerSession();
  if (!session) return [];
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return [];

  const rows = await db
    .select({
      modelId: schema.activations.modelId,
      modelName: schema.models.name,
      qty: sql<number>`COUNT(*)`.as("qty"),
    })
    .from(schema.activations)
    .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
    .where(
      and(
        eq(schema.activations.tenantId, session.tenantId),
        eq(schema.activations.dealerId, dealerId),
        gte(schema.activations.activationDate, from),
        lte(schema.activations.activationDate, to),
      ),
    )
    .groupBy(schema.activations.modelId, schema.models.name)
    .orderBy(asc(schema.models.name));

  return rows.map((r) => ({ ...r, qty: Number(r.qty) }));
}

export type DealerDashboardStats = {
  todayActivations: number;
  monthActivations: number;
  purchaseRecords: number;
  pendingCrossRegion: number;
  pendingInbound: number;
  dealerName: string | null;
  dealerId: string | null;
  tenantId: string;
  sixMonthTrend: Array<{ label: string; total: number; activations: number }>;
  stock: StockRow[];
};

async function buildSixMonthTrend(
  tenantId: string,
  dealerId: string,
): Promise<Array<{ label: string; total: number; activations: number }>> {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return {
      label: start.toLocaleString("en-US", { month: "short" }),
      startStr: start.toISOString().slice(0, 10),
      endStr: end.toISOString().slice(0, 10),
      ym: start.toISOString().slice(0, 7),
    };
  });

  const rows = await db
    .select({
      ym: sql<string>`LEFT(${schema.activations.activationDate}, 7)`,
      c: count(),
    })
    .from(schema.activations)
    .where(
      and(
        eq(schema.activations.tenantId, tenantId),
        eq(schema.activations.dealerId, dealerId),
        gte(schema.activations.activationDate, months[0].startStr),
        lte(schema.activations.activationDate, months[months.length - 1].endStr),
      ),
    )
    .groupBy(sql`LEFT(${schema.activations.activationDate}, 7)`);

  const byMonth = new Map(rows.map((r) => [r.ym, Number(r.c)]));
  return months.map((m) => ({
    label: m.label,
    total: 0,
    activations: byMonth.get(m.ym) ?? 0,
  }));
}

export async function getDealerDashboardStats(): Promise<DealerDashboardStats> {
  const session = await getDealerSession();
  if (!session) throw new Error("Unauthorized");

  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);

  if (!dealerId) {
    return {
      todayActivations: 0,
      monthActivations: 0,
      purchaseRecords: 0,
      pendingCrossRegion: 0,
      pendingInbound: 0,
      dealerName: null,
      dealerId: null,
      tenantId,
      sixMonthTrend: [],
      stock: [],
    };
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [
    todayRows,
    monthRows,
    purchaseRows,
    dealerRows,
    pendingCrossRegion,
    pendingInboundRows,
    sixMonthTrend,
    stock,
  ] = await Promise.all([
    db
      .select({ c: count() })
      .from(schema.activations)
      .where(
        and(
          eq(schema.activations.tenantId, tenantId),
          eq(schema.activations.dealerId, dealerId),
          eq(schema.activations.activationDate, today),
        ),
      ),
    db
      .select({ c: count() })
      .from(schema.activations)
      .where(
        and(
          eq(schema.activations.tenantId, tenantId),
          eq(schema.activations.dealerId, dealerId),
          gte(schema.activations.activationDate, monthStart),
          lte(schema.activations.activationDate, monthEnd),
        ),
      ),
    db
      .select({ c: count() })
      .from(schema.purchases)
      .where(
        and(
          eq(schema.purchases.tenantId, tenantId),
          eq(schema.purchases.dealerId, dealerId),
          gte(schema.purchases.purchaseDate, monthStart),
          lte(schema.purchases.purchaseDate, monthEnd),
        ),
      ),
    db
      .select({ name: schema.dealerIds.name })
      .from(schema.dealerIds)
      .where(
        and(
          eq(schema.dealerIds.tenantId, tenantId),
          eq(schema.dealerIds.id, dealerId),
        ),
      )
      .limit(1),
    countPendingCrossRegion(tenantId, dealerId),
    listPendingInbound(tenantId, dealerId),
    buildSixMonthTrend(tenantId, dealerId),
    listStockForDealer(tenantId, dealerId, OWNER_TENANT_ID),
  ]);

  return {
    todayActivations: Number(todayRows[0]?.c ?? 0),
    monthActivations: Number(monthRows[0]?.c ?? 0),
    purchaseRecords: Number(purchaseRows[0]?.c ?? 0),
    pendingCrossRegion,
    pendingInbound: pendingInboundRows.length,
    dealerName: dealerRows[0]?.name ?? null,
    dealerId,
    tenantId,
    sixMonthTrend,
    stock,
  };
}

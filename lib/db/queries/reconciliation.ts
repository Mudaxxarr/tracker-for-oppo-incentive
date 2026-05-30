import "server-only";
import { db, schema } from "../client";
import { and, eq, gt, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { INTER_ID_STATUS } from "@/lib/constants";

export interface ReconciliationRow {
  modelId: string;
  modelName: string;
  dealerPrice: number | null;
  openingStock: number;
  purchasesToday: number;
  dbActivationsToday: number;
}

export async function getDailyReconciliationRows(
  tenantId: string,
  dealerId: string,
  date: string
): Promise<ReconciliationRow[]> {
  const today = new Date().toISOString().slice(0, 10);

  const [
    purchasesBefore,
    activationsBefore,
    transfersOutBefore,
    crCaughtBefore,
    purchasesTodayRows,
    activationsTodayRows,
  ] = await Promise.all([
    db
      .select({ modelId: schema.purchases.modelId, qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), lt(schema.purchases.purchaseDate, date)))
      .groupBy(schema.purchases.modelId),

    db
      .select({ modelId: schema.activations.modelId, qty: sql<number>`COUNT(*)` })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), lt(schema.activations.activationDate, date)))
      .groupBy(schema.activations.modelId),

    db
      .select({ modelId: schema.interIdTransfers.modelId, qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
      .from(schema.interIdTransfers)
      .where(and(
        eq(schema.interIdTransfers.tenantId, tenantId),
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        lt(schema.interIdTransfers.transferDate, date),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      ))
      .groupBy(schema.interIdTransfers.modelId),

    db
      .select({ modelId: schema.crCaught.modelId, qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)` })
      .from(schema.crCaught)
      .where(and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        lt(schema.crCaught.caughtDate, date),
        ne(schema.crCaught.status, "pending_owner_approval")
      ))
      .groupBy(schema.crCaught.modelId),

    db
      .select({ modelId: schema.purchases.modelId, qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.purchaseDate, date)))
      .groupBy(schema.purchases.modelId),

    db
      .select({ modelId: schema.activations.modelId, qty: sql<number>`COUNT(*)` })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.activationDate, date)))
      .groupBy(schema.activations.modelId),
  ]);

  const purchaseBeforeMap = new Map<string, number>();
  for (const r of purchasesBefore) purchaseBeforeMap.set(r.modelId, Number(r.qty));
  const activationBeforeMap = new Map<string, number>();
  for (const r of activationsBefore) activationBeforeMap.set(r.modelId, Number(r.qty));
  const transferOutBeforeMap = new Map<string, number>();
  for (const r of transfersOutBefore) transferOutBeforeMap.set(r.modelId, Number(r.qty));
  const crCaughtBeforeMap = new Map<string, number>();
  for (const r of crCaughtBefore) crCaughtBeforeMap.set(r.modelId, Number(r.qty));
  const purchaseTodayMap = new Map<string, number>();
  for (const r of purchasesTodayRows) purchaseTodayMap.set(r.modelId, Number(r.qty));
  const activationTodayMap = new Map<string, number>();
  for (const r of activationsTodayRows) activationTodayMap.set(r.modelId, Number(r.qty));

  const allModelIds = new Set<string>([...purchaseBeforeMap.keys(), ...purchaseTodayMap.keys()]);
  if (allModelIds.size === 0) return [];

  const openingMap = new Map<string, number>();
  for (const modelId of allModelIds) {
    const opening =
      (purchaseBeforeMap.get(modelId) ?? 0) -
      (activationBeforeMap.get(modelId) ?? 0) -
      (transferOutBeforeMap.get(modelId) ?? 0) -
      (crCaughtBeforeMap.get(modelId) ?? 0);
    openingMap.set(modelId, opening);
  }

  const relevantIds = [...allModelIds].filter(
    (id) => (openingMap.get(id) ?? 0) > 0 || (purchaseTodayMap.get(id) ?? 0) > 0
  );
  if (relevantIds.length === 0) return [];

  const meta = await db
    .select({ id: schema.models.id, name: schema.models.name, dealerPrice: schema.modelPriceHistory.dealerPrice })
    .from(schema.models)
    .leftJoin(
      schema.modelPriceHistory,
      and(
        eq(schema.modelPriceHistory.tenantId, tenantId),
        eq(schema.modelPriceHistory.modelId, schema.models.id),
        lte(schema.modelPriceHistory.effectiveFrom, today),
        or(isNull(schema.modelPriceHistory.effectiveTo), gt(schema.modelPriceHistory.effectiveTo, today))
      )
    )
    .where(sql`${schema.models.id} IN (${sql.join(relevantIds.map((i) => sql`${i}`), sql`, `)})`);

  return meta
    .map((m): ReconciliationRow => ({
      modelId: m.id,
      modelName: m.name,
      dealerPrice: m.dealerPrice,
      openingStock: openingMap.get(m.id) ?? 0,
      purchasesToday: purchaseTodayMap.get(m.id) ?? 0,
      dbActivationsToday: activationTodayMap.get(m.id) ?? 0,
    }))
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

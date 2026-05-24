import "server-only";
import { db, schema } from "../client";
import { and, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";
import { INTER_ID_STATUS } from "@/lib/constants";

export interface InventoryModelRow {
  modelId: string; modelName: string; dealerPrice: number | null;
  invoicePrice: number | null; totalStock: number;
  regularQty: number; crossRegionQty: number; interIdInQty: number;
  earliestPurchaseDate: string | null;
}

export async function listInventoryForDealer(tenantId: string, dealerId: string, priceTenantId?: string): Promise<InventoryModelRow[]> {
  const today = new Date().toISOString().slice(0, 10);

  const [purchaseRows, activationRows, transferOutRows, crCaughtRows, interIdInRows, earliestDateRows] = await Promise.all([
    db
      .select({ modelId: schema.purchases.modelId, source: schema.purchases.source, qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId)))
      .groupBy(schema.purchases.modelId, schema.purchases.source),
    db
      .select({ modelId: schema.activations.modelId, qty: sql<number>`COUNT(*)` })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId)))
      .groupBy(schema.activations.modelId),
    db
      .select({ modelId: schema.interIdTransfers.modelId, qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
      .from(schema.interIdTransfers)
      .where(and(eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.fromDealerId, dealerId), ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)))
      .groupBy(schema.interIdTransfers.modelId),
    db
      .select({ modelId: schema.crCaught.modelId, qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)` })
      .from(schema.crCaught)
      .where(and(eq(schema.crCaught.tenantId, tenantId), eq(schema.crCaught.dealerId, dealerId)))
      .groupBy(schema.crCaught.modelId),
    db
      .select({ modelId: schema.interIdTransfers.modelId, qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
      .from(schema.interIdTransfers)
      .where(and(eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.toDealerId, dealerId), eq(schema.interIdTransfers.status, INTER_ID_STATUS.ACCEPTED)))
      .groupBy(schema.interIdTransfers.modelId),
    db
      .select({ modelId: schema.purchases.modelId, minDate: sql<string>`MIN(${schema.purchases.purchaseDate})` })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId)))
      .groupBy(schema.purchases.modelId),
  ]);

  const activatedMap = new Map<string, number>();
  for (const r of activationRows) activatedMap.set(r.modelId, Number(r.qty));
  const transferOutMap = new Map<string, number>();
  for (const r of transferOutRows) transferOutMap.set(r.modelId, Number(r.qty));
  const crCaughtMap = new Map<string, number>();
  for (const r of crCaughtRows) crCaughtMap.set(r.modelId, Number(r.qty));
  const regularMap = new Map<string, number>();
  const crossRegionMap = new Map<string, number>();
  const interIdMap = new Map<string, number>();
  const allModelIds = new Set<string>();
  const earliestDateMap = new Map<string, string>();
  for (const r of earliestDateRows) earliestDateMap.set(r.modelId, r.minDate);

  for (const r of purchaseRows) {
    allModelIds.add(r.modelId);
    if (r.source === "CROSS_REGION_TRANSFER_IN") {
      crossRegionMap.set(r.modelId, (crossRegionMap.get(r.modelId) ?? 0) + Number(r.qty));
    } else {
      regularMap.set(r.modelId, (regularMap.get(r.modelId) ?? 0) + Number(r.qty));
    }
  }
  for (const r of interIdInRows) {
    allModelIds.add(r.modelId);
    interIdMap.set(r.modelId, Number(r.qty));
    regularMap.set(r.modelId, Math.max(0, (regularMap.get(r.modelId) ?? 0) - Number(r.qty)));
  }

  const netStock = new Map<string, number>();
  for (const modelId of allModelIds) {
    const total = (regularMap.get(modelId) ?? 0) + (crossRegionMap.get(modelId) ?? 0) + (interIdMap.get(modelId) ?? 0);
    const used = (activatedMap.get(modelId) ?? 0) + (transferOutMap.get(modelId) ?? 0) + (crCaughtMap.get(modelId) ?? 0);
    netStock.set(modelId, total - used);
  }

  const positiveIds = [...netStock.entries()].filter(([, q]) => q > 0).map(([id]) => id);
  if (positiveIds.length === 0) return [];

  const meta = await db
    .select({ id: schema.models.id, name: schema.models.name, dealerPrice: schema.modelPriceHistory.dealerPrice, invoicePrice: schema.modelPriceHistory.invoicePrice })
    .from(schema.models)
    .leftJoin(
      schema.modelPriceHistory,
      and(
        eq(schema.modelPriceHistory.tenantId, priceTenantId ?? tenantId),
        eq(schema.modelPriceHistory.modelId, schema.models.id),
        lte(schema.modelPriceHistory.effectiveFrom, today),
        or(isNull(schema.modelPriceHistory.effectiveTo), gt(schema.modelPriceHistory.effectiveTo, today))
      )
    )
    .where(sql`${schema.models.id} IN (${sql.join(positiveIds.map((i) => sql`${i}`), sql`, `)})`);

  return meta
    .map((m): InventoryModelRow => ({
      modelId: m.id, modelName: m.name, dealerPrice: m.dealerPrice, invoicePrice: m.invoicePrice,
      totalStock: netStock.get(m.id) ?? 0,
      regularQty: regularMap.get(m.id) ?? 0,
      crossRegionQty: crossRegionMap.get(m.id) ?? 0,
      interIdInQty: interIdMap.get(m.id) ?? 0,
      earliestPurchaseDate: earliestDateMap.get(m.id) ?? null,
    }))
    .filter((r) => r.totalStock > 0)
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

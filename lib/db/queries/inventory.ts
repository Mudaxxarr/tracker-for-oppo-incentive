import "server-only";
import { db, schema } from "../client";
import { and, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";
import { INTER_ID_STATUS } from "@/lib/constants";

export interface InventoryModelRow {
  modelId: string;
  modelName: string;
  dealerPrice: number | null;
  invoicePrice: number | null;
  totalStock: number;
  regularQty: number;         // REGULAR purchases
  crossRegionQty: number;     // CROSS_REGION_TRANSFER_IN purchases
  interIdInQty: number;       // Inter-ID received (note contains "Inter-ID transfer in")
}

/**
 * Returns current stock per model broken down by source type.
 * Useful for the inventory tab which shows color-coded source badges.
 */
export async function listInventoryForDealer(dealerId: string): Promise<InventoryModelRow[]> {
  const today = new Date().toISOString().slice(0, 10);

  // Raw purchases grouped by model + source
  const purchaseRows = await db
    .select({
      modelId: schema.purchases.modelId,
      source: schema.purchases.source,
      qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)`.as("qty"),
    })
    .from(schema.purchases)
    .where(eq(schema.purchases.dealerId, dealerId))
    .groupBy(schema.purchases.modelId, schema.purchases.source);

  // Activations per model
  const activationRows = await db
    .select({
      modelId: schema.activations.modelId,
      qty: sql<number>`COUNT(*)`.as("qty"),
    })
    .from(schema.activations)
    .where(eq(schema.activations.dealerId, dealerId))
    .groupBy(schema.activations.modelId);

  // Outbound inter-ID transfers per model (exclude REJECTED — those units stayed with the source)
  const transferOutRows = await db
    .select({
      modelId: schema.interIdTransfers.modelId,
      qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)`.as("qty"),
    })
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      )
    )
    .groupBy(schema.interIdTransfers.modelId);

  // Build maps
  const activatedMap = new Map<string, number>();
  for (const r of activationRows) activatedMap.set(r.modelId, Number(r.qty));

  const transferOutMap = new Map<string, number>();
  for (const r of transferOutRows) transferOutMap.set(r.modelId, Number(r.qty));

  const regularMap = new Map<string, number>();
  const crossRegionMap = new Map<string, number>();
  const interIdMap = new Map<string, number>();
  const allModelIds = new Set<string>();

  for (const r of purchaseRows) {
    allModelIds.add(r.modelId);
    if (r.source === "CROSS_REGION_TRANSFER_IN") {
      crossRegionMap.set(r.modelId, (crossRegionMap.get(r.modelId) ?? 0) + Number(r.qty));
    } else {
      // REGULAR — split inter-id received from true purchases via referenceNote
      // (Note: inter-ID inbound creates a REGULAR purchase row; we just count all REGULAR here)
      regularMap.set(r.modelId, (regularMap.get(r.modelId) ?? 0) + Number(r.qty));
    }
  }

  // CR Caught — deduct from inventory
  const crCaughtRows = await db
    .select({
      modelId: schema.crCaught.modelId,
      qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)`.as("qty"),
    })
    .from(schema.crCaught)
    .where(eq(schema.crCaught.dealerId, dealerId))
    .groupBy(schema.crCaught.modelId);

  const crCaughtMap = new Map<string, number>();
  for (const r of crCaughtRows) crCaughtMap.set(r.modelId, Number(r.qty));

  // Inter-ID inbound — only ACCEPTED (PENDING have no purchase row yet, REJECTED never will)
  const interIdInRows = await db
    .select({
      modelId: schema.interIdTransfers.modelId,
      qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)`.as("qty"),
    })
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.toDealerId, dealerId),
        eq(schema.interIdTransfers.status, INTER_ID_STATUS.ACCEPTED)
      )
    )
    .groupBy(schema.interIdTransfers.modelId);

  for (const r of interIdInRows) {
    allModelIds.add(r.modelId);
    interIdMap.set(r.modelId, Number(r.qty));
    // Subtract from regularMap since inter-ID in is stored as REGULAR purchase
    regularMap.set(r.modelId, Math.max(0, (regularMap.get(r.modelId) ?? 0) - Number(r.qty)));
  }

  // Compute net stock per model
  const netStock = new Map<string, number>();
  for (const modelId of allModelIds) {
    const total = (regularMap.get(modelId) ?? 0)
      + (crossRegionMap.get(modelId) ?? 0)
      + (interIdMap.get(modelId) ?? 0);
    const used = (activatedMap.get(modelId) ?? 0)
      + (transferOutMap.get(modelId) ?? 0)
      + (crCaughtMap.get(modelId) ?? 0);
    netStock.set(modelId, total - used);
  }

  const positiveIds = [...netStock.entries()].filter(([, q]) => q > 0).map(([id]) => id);
  if (positiveIds.length === 0) return [];

  const meta = await db
    .select({
      id: schema.models.id,
      name: schema.models.name,
      dealerPrice: schema.modelPriceHistory.dealerPrice,
      invoicePrice: schema.modelPriceHistory.invoicePrice,
    })
    .from(schema.models)
    .leftJoin(
      schema.modelPriceHistory,
      and(
        eq(schema.modelPriceHistory.modelId, schema.models.id),
        lte(schema.modelPriceHistory.effectiveFrom, today),
        or(
          isNull(schema.modelPriceHistory.effectiveTo),
          gt(schema.modelPriceHistory.effectiveTo, today)
        )
      )
    )
    .where(sql`${schema.models.id} IN (${sql.join(positiveIds.map((i) => sql`${i}`), sql`, `)})`);

  return meta
    .map((m): InventoryModelRow => ({
      modelId: m.id,
      modelName: m.name,
      dealerPrice: m.dealerPrice,
      invoicePrice: m.invoicePrice,
      totalStock: netStock.get(m.id) ?? 0,
      regularQty: regularMap.get(m.id) ?? 0,
      crossRegionQty: crossRegionMap.get(m.id) ?? 0,
      interIdInQty: interIdMap.get(m.id) ?? 0,
    }))
    .filter((r) => r.totalStock > 0)
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

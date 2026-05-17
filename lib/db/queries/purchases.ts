import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { INTER_ID_STATUS } from "@/lib/constants";
import { randomUUID } from "node:crypto";
import type { PurchaseSource } from "@/lib/constants";
import { getCrCaughtForStockCalc, getCrCaughtAsOf } from "./cr-caught";

export interface StockRow {
  modelId: string;
  modelName: string;
  dealerPrice: number | null;
  invoicePrice: number | null;
  quantity: number;
}

/**
 * Net on-hand stock per model for a dealer.
 *  + purchases (REGULAR + cross-region transfer-in + inter-id inbound — all stored as purchases)
 *  − activations (each activation is 1 unit)
 *  − inter-ID outbound transfers (fromDealerId = dealerId; inbound is already a purchase row)
 * Returns only models with positive net stock, joined with current price.
 */
export async function listStockForDealer(dealerId: string): Promise<StockRow[]> {
  const today = new Date().toISOString().slice(0, 10);

  const purchaseQty = await db
    .select({
      modelId: schema.purchases.modelId,
      qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)`.as("qty"),
    })
    .from(schema.purchases)
    .where(eq(schema.purchases.dealerId, dealerId))
    .groupBy(schema.purchases.modelId);

  const activatedQty = await db
    .select({
      modelId: schema.activations.modelId,
      qty: sql<number>`COUNT(*)`.as("qty"),
    })
    .from(schema.activations)
    .where(eq(schema.activations.dealerId, dealerId))
    .groupBy(schema.activations.modelId);

  const transferredOutQty = await db
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

  const crCaughtQty = await db
    .select({
      modelId: schema.crCaught.modelId,
      qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)`.as("qty"),
    })
    .from(schema.crCaught)
    .where(eq(schema.crCaught.dealerId, dealerId))
    .groupBy(schema.crCaught.modelId);

  const byModel = new Map<string, number>();
  for (const r of purchaseQty) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) + Number(r.qty));
  for (const r of activatedQty) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) - Number(r.qty));
  for (const r of transferredOutQty)
    byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) - Number(r.qty));
  for (const r of crCaughtQty)
    byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) - Number(r.qty));

  const ids = [...byModel.entries()].filter(([, q]) => q > 0).map(([id]) => id);
  if (ids.length === 0) return [];

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
        sql`(${schema.modelPriceHistory.effectiveTo} IS NULL OR ${schema.modelPriceHistory.effectiveTo} > ${today})`
      )
    )
    .where(sql`${schema.models.id} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);

  return meta
    .map((m) => ({
      modelId: m.id,
      modelName: m.name,
      dealerPrice: m.dealerPrice,
      invoicePrice: m.invoicePrice,
      quantity: byModel.get(m.id) ?? 0,
    }))
    .filter((r) => r.quantity > 0)
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

/** Net stock for one (dealer, model). Useful for server-side validation. */
export async function getStockForModel(dealerId: string, modelId: string): Promise<number> {
  const [{ qty: pq }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)`.as("qty") })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.modelId, modelId)));
  const [{ qty: aq }] = await db
    .select({ qty: sql<number>`COUNT(*)`.as("qty") })
    .from(schema.activations)
    .where(and(eq(schema.activations.dealerId, dealerId), eq(schema.activations.modelId, modelId)));
  const [{ qty: tq }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)`.as("qty") })
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        eq(schema.interIdTransfers.modelId, modelId),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      )
    );
  const crcQty = await getCrCaughtForStockCalc(dealerId, modelId);
  return Number(pq) - Number(aq) - Number(tq) - crcQty;
}

/**
 * Net stock for one (dealer, model) as of a specific date.
 * Only counts purchases, activations, and outbound transfers up to and including `asOf`.
 * Used to validate date-bounded moves (can't move stock that didn't exist on the transfer date).
 */
export async function getStockForModelAsOf(
  dealerId: string,
  modelId: string,
  asOf: string
): Promise<number> {
  const [{ qty: pq }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)`.as("qty") })
    .from(schema.purchases)
    .where(
      and(
        eq(schema.purchases.dealerId, dealerId),
        eq(schema.purchases.modelId, modelId),
        lte(schema.purchases.purchaseDate, asOf)
      )
    );
  const [{ qty: aq }] = await db
    .select({ qty: sql<number>`COUNT(*)`.as("qty") })
    .from(schema.activations)
    .where(
      and(
        eq(schema.activations.dealerId, dealerId),
        eq(schema.activations.modelId, modelId),
        lte(schema.activations.activationDate, asOf)
      )
    );
  const [{ qty: tq }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)`.as("qty") })
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        eq(schema.interIdTransfers.modelId, modelId),
        lte(schema.interIdTransfers.transferDate, asOf),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      )
    );
  const crcQty = await getCrCaughtAsOf(dealerId, modelId, asOf);
  return Number(pq) - Number(aq) - Number(tq) - crcQty;
}

export interface PurchaseRow {
  id: string;
  modelId: string;
  modelName: string;
  quantity: number;
  unitDealerPrice: number;
  unitInvoicePrice: number;
  purchaseDate: string;
  source: string;
  referenceNote: string | null;
  crossRegionTransferId: string | null;
}

export async function listPurchases(filters: {
  dealerId: string;
  modelId?: string;
  source?: PurchaseSource;
  from?: string;
  to?: string;
}): Promise<PurchaseRow[]> {
  const where = [eq(schema.purchases.dealerId, filters.dealerId)];
  if (filters.modelId) where.push(eq(schema.purchases.modelId, filters.modelId));
  if (filters.source) where.push(eq(schema.purchases.source, filters.source));
  if (filters.from) where.push(gte(schema.purchases.purchaseDate, filters.from));
  if (filters.to) where.push(lte(schema.purchases.purchaseDate, filters.to));

  const rows = await db
    .select({
      id: schema.purchases.id,
      modelId: schema.purchases.modelId,
      modelName: schema.models.name,
      quantity: schema.purchases.quantity,
      unitDealerPrice: schema.purchases.unitDealerPrice,
      unitInvoicePrice: schema.purchases.unitInvoicePrice,
      purchaseDate: schema.purchases.purchaseDate,
      source: schema.purchases.source,
      referenceNote: schema.purchases.referenceNote,
      crossRegionTransferId: schema.purchases.crossRegionTransferId,
    })
    .from(schema.purchases)
    .innerJoin(schema.models, eq(schema.models.id, schema.purchases.modelId))
    .where(and(...where))
    .orderBy(desc(schema.purchases.purchaseDate), asc(schema.models.name));
  return rows;
}

export async function createPurchase(input: {
  dealerId: string;
  modelId: string;
  quantity: number;
  unitDealerPrice: number;
  unitInvoicePrice: number;
  purchaseDate: string;
  source: PurchaseSource;
  referenceNote: string | null;
  crossRegionTransferId?: string | null;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.purchases).values({
    id,
    dealerId: input.dealerId,
    modelId: input.modelId,
    quantity: input.quantity,
    unitDealerPrice: input.unitDealerPrice,
    unitInvoicePrice: input.unitInvoicePrice,
    purchaseDate: input.purchaseDate,
    source: input.source,
    referenceNote: input.referenceNote,
    crossRegionTransferId: input.crossRegionTransferId ?? null,
  });
  return id;
}

export async function deletePurchase(id: string, dealerId: string): Promise<void> {
  await db
    .delete(schema.purchases)
    .where(and(eq(schema.purchases.id, id), eq(schema.purchases.dealerId, dealerId)));
}

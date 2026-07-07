import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, gte, lt, lte, ne, sql } from "drizzle-orm";
import { INTER_ID_STATUS, PURCHASE_SOURCE, PURCHASE_REVIEW_STATUS } from "@/lib/constants";
import { randomUUID } from "node:crypto";
import type { PurchaseSource } from "@/lib/constants";
import { getCrCaughtForStockCalc, getCrCaughtAsOf, getCrCaughtBefore } from "./cr-caught";
import { formatBillNumber, groupIntoBills, aggregatePurchaseStats, computePreviousPeriod, percentChange, type PurchaseAggregateStats, type BillGroup } from "@/lib/purchases/purchase-stats";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface StockRow {
  modelId: string;
  modelName: string;
  dealerPrice: number | null;
  invoicePrice: number | null;
  quantity: number;
}

export async function listStockForDealer(tenantId: string, dealerId: string, priceTenantId?: string): Promise<StockRow[]> {
  const today = new Date().toISOString().slice(0, 10);

  const [purchaseQty, activatedQty, transferredOutQty, crCaughtQty] = await Promise.all([
    db
      .select({ modelId: schema.purchases.modelId, qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), ne(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW)))
      .groupBy(schema.purchases.modelId),
    db
      .select({ modelId: schema.activations.modelId, qty: sql<number>`COUNT(*)` })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId)))
      .groupBy(schema.activations.modelId),
    db
      .select({ modelId: schema.interIdTransfers.modelId, qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
      .from(schema.interIdTransfers)
      .where(
        and(
          eq(schema.interIdTransfers.tenantId, tenantId),
          eq(schema.interIdTransfers.fromDealerId, dealerId),
          ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
        )
      )
      .groupBy(schema.interIdTransfers.modelId),
    db
      .select({ modelId: schema.crCaught.modelId, qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)` })
      .from(schema.crCaught)
      .where(and(eq(schema.crCaught.tenantId, tenantId), eq(schema.crCaught.dealerId, dealerId)))
      .groupBy(schema.crCaught.modelId),
  ]);

  const byModel = new Map<string, number>();
  for (const r of purchaseQty) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) + Number(r.qty));
  for (const r of activatedQty) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) - Number(r.qty));
  for (const r of transferredOutQty) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) - Number(r.qty));
  for (const r of crCaughtQty) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) - Number(r.qty));

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
        eq(schema.modelPriceHistory.tenantId, priceTenantId ?? tenantId),
        eq(schema.modelPriceHistory.modelId, schema.models.id),
        lte(schema.modelPriceHistory.effectiveFrom, today),
        sql`(${schema.modelPriceHistory.effectiveTo} IS NULL OR ${schema.modelPriceHistory.effectiveTo} > ${today})`
      )
    )
    .where(sql`${schema.models.id} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);

  return meta
    .map((m) => ({ modelId: m.id, modelName: m.name, dealerPrice: m.dealerPrice, invoicePrice: m.invoicePrice, quantity: byModel.get(m.id) ?? 0 }))
    .filter((r) => r.quantity > 0)
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

export async function getStockForModel(tenantId: string, dealerId: string, modelId: string, executor: Executor = db): Promise<number> {
  const [[{ qty: pq }], [{ qty: aq }], [{ qty: tq }], crcQty] = await Promise.all([
    executor.select({ qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.modelId, modelId), ne(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW))),
    executor.select({ qty: sql<number>`COUNT(*)` })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.modelId, modelId))),
    executor.select({ qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
      .from(schema.interIdTransfers)
      .where(and(
        eq(schema.interIdTransfers.tenantId, tenantId),
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        eq(schema.interIdTransfers.modelId, modelId),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      )),
    getCrCaughtForStockCalc(tenantId, dealerId, modelId),
  ]);
  return Number(pq) - Number(aq) - Number(tq) - crcQty;
}

export async function getStockForModelAsOf(tenantId: string, dealerId: string, modelId: string, asOf: string): Promise<number> {
  const [[{ qty: pq }], [{ qty: aq }], [{ qty: tq }], crcQty] = await Promise.all([
    db.select({ qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.modelId, modelId), lte(schema.purchases.purchaseDate, asOf), ne(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW))),
    db.select({ qty: sql<number>`COUNT(*)` })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.modelId, modelId), lte(schema.activations.activationDate, asOf))),
    db.select({ qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
      .from(schema.interIdTransfers)
      .where(and(
        eq(schema.interIdTransfers.tenantId, tenantId),
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        eq(schema.interIdTransfers.modelId, modelId),
        lte(schema.interIdTransfers.transferDate, asOf),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      )),
    getCrCaughtAsOf(tenantId, dealerId, modelId, asOf),
  ]);
  return Number(pq) - Number(aq) - Number(tq) - crcQty;
}

/**
 * Minimum net stock over the window [fromDate, ∞) for one model.
 *
 * The point-in-time `getStockForModelAsOf` is NOT sufficient to guard a backdated
 * consuming event: inserting a sale on a past date subtracts from stock on every
 * later date too, so it can push an intermediate day negative even when both the
 * as-of-date stock and the current stock look fine. This walks the full
 * purchase/activation/transfer/CR timeline and returns the lowest the running
 * balance ever reaches on or after `fromDate`. A consuming event of qty is safe
 * iff this value >= qty.
 */
export async function getMinForwardStock(
  tenantId: string,
  dealerId: string,
  modelId: string,
  fromDate: string,
  executor: Executor = db
): Promise<number> {
  const [purchases, activations, transfers, crc] = await Promise.all([
    executor.select({ date: schema.purchases.purchaseDate, qty: schema.purchases.quantity })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.modelId, modelId), ne(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW))),
    executor.select({ date: schema.activations.activationDate })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.modelId, modelId))),
    executor.select({ date: schema.interIdTransfers.transferDate, qty: schema.interIdTransfers.quantity })
      .from(schema.interIdTransfers)
      .where(and(
        eq(schema.interIdTransfers.tenantId, tenantId),
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        eq(schema.interIdTransfers.modelId, modelId),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      )),
    executor.select({ date: schema.crCaught.caughtDate, qty: schema.crCaught.quantity })
      .from(schema.crCaught)
      .where(and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        eq(schema.crCaught.modelId, modelId),
        ne(schema.crCaught.status, "pending_owner_approval")
      )),
  ]);

  // Net delta per date: purchases add, everything else consumes.
  const deltas = new Map<string, number>();
  for (const p of purchases) deltas.set(p.date, (deltas.get(p.date) ?? 0) + Number(p.qty));
  for (const a of activations) deltas.set(a.date, (deltas.get(a.date) ?? 0) - 1);
  for (const t of transfers) deltas.set(t.date, (deltas.get(t.date) ?? 0) - Number(t.qty));
  for (const c of crc) deltas.set(c.date, (deltas.get(c.date) ?? 0) - Number(c.qty));

  const dates = [...deltas.keys()].sort();
  // Running balance up to and including fromDate = stock as-of fromDate.
  let running = 0;
  for (const d of dates) if (d <= fromDate) running += deltas.get(d)!;
  let min = running;
  // Walk forward; stock only dips at later consuming events.
  for (const d of dates) {
    if (d > fromDate) {
      running += deltas.get(d)!;
      if (running < min) min = running;
    }
  }
  return min;
}

/**
 * Closing stock strictly before `beforeDate` — i.e., end-of-day snapshot of (beforeDate - 1).
 * Used by the rebate engine so that units activated ON the price-drop date do not reduce
 * the eligible quantity. All four stock components use strict < to enforce the midnight boundary.
 */
export async function getClosingStockBeforeDate(tenantId: string, dealerId: string, modelId: string, beforeDate: string): Promise<number> {
  const [[{ qty: pq }], [{ qty: aq }], [{ qty: tq }], crcQty] = await Promise.all([
    db.select({ qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.modelId, modelId), lt(schema.purchases.purchaseDate, beforeDate), ne(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW))),
    db.select({ qty: sql<number>`COUNT(*)` })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.modelId, modelId), lt(schema.activations.activationDate, beforeDate))),
    db.select({ qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
      .from(schema.interIdTransfers)
      .where(and(
        eq(schema.interIdTransfers.tenantId, tenantId),
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        eq(schema.interIdTransfers.modelId, modelId),
        lt(schema.interIdTransfers.transferDate, beforeDate),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      )),
    getCrCaughtBefore(tenantId, dealerId, modelId, beforeDate),
  ]);
  return Number(pq) - Number(aq) - Number(tq) - crcQty;
}

export interface CrStockRow {
  modelId: string;
  modelName: string;
  crPurchased: number;
  crActivated: number;
  crRemaining: number;
}

/** Returns models that have CR-sourced stock, with qty purchased via CR vs how many have been activated as CR. */
export async function getCrStockSummary(tenantId: string, dealerId: string): Promise<CrStockRow[]> {
  const [purchased, activated] = await Promise.all([
    db
      .select({ modelId: schema.purchases.modelId, qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.source, PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN)))
      .groupBy(schema.purchases.modelId),
    db
      .select({ modelId: schema.activations.modelId, qty: sql<number>`COUNT(*)` })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.isCrossRegion, true)))
      .groupBy(schema.activations.modelId),
  ]);

  if (purchased.length === 0) return [];

  const activatedMap = new Map(activated.map((r) => [r.modelId, Number(r.qty)]));
  const modelIds = purchased.map((r) => r.modelId);
  const meta = await db
    .select({ id: schema.models.id, name: schema.models.name })
    .from(schema.models)
    .where(sql`${schema.models.id} IN (${sql.join(modelIds.map((id) => sql`${id}`), sql`, `)})`);
  const nameMap = new Map(meta.map((m) => [m.id, m.name]));

  return purchased
    .map((r) => {
      const crPurchased = Number(r.qty);
      const crActivated = activatedMap.get(r.modelId) ?? 0;
      return { modelId: r.modelId, modelName: nameMap.get(r.modelId) ?? r.modelId, crPurchased, crActivated, crRemaining: Math.max(0, crPurchased - crActivated) };
    })
    .filter((r) => r.crPurchased > 0)
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

/** Next auto bill number for this dealer+date — restarts at 1 each calendar day. Display-only, never user-typed. */
export async function getNextBillNumber(tenantId: string, dealerId: string, purchaseDate: string, executor: Executor = db): Promise<string> {
  const rows = await executor
    .select({ count: sql<number>`COUNT(DISTINCT ${schema.purchases.billNumber})` })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.purchaseDate, purchaseDate)));
  return formatBillNumber(purchaseDate, Number(rows[0].count) + 1);
}

export interface PurchaseRow {
  id: string; modelId: string; modelName: string; quantity: number;
  unitDealerPrice: number; unitInvoicePrice: number; purchaseDate: string;
  source: string; referenceNote: string | null; crossRegionTransferId: string | null;
  billNumber: string;
}

export async function listPurchases(filters: {
  tenantId: string; dealerId: string; modelId?: string; source?: PurchaseSource; from?: string; to?: string;
}): Promise<PurchaseRow[]> {
  const where = [eq(schema.purchases.tenantId, filters.tenantId), eq(schema.purchases.dealerId, filters.dealerId)];
  if (filters.modelId) where.push(eq(schema.purchases.modelId, filters.modelId));
  if (filters.source) where.push(eq(schema.purchases.source, filters.source));
  if (filters.from) where.push(gte(schema.purchases.purchaseDate, filters.from));
  if (filters.to) where.push(lte(schema.purchases.purchaseDate, filters.to));

  return db
    .select({
      id: schema.purchases.id, modelId: schema.purchases.modelId, modelName: schema.models.name,
      quantity: schema.purchases.quantity, unitDealerPrice: schema.purchases.unitDealerPrice,
      unitInvoicePrice: schema.purchases.unitInvoicePrice, purchaseDate: schema.purchases.purchaseDate,
      source: schema.purchases.source, referenceNote: schema.purchases.referenceNote,
      crossRegionTransferId: schema.purchases.crossRegionTransferId,
      billNumber: sql<string>`COALESCE(${schema.purchases.billNumber}, 'INV-LEGACY-' || ${schema.purchases.id})`,
    })
    .from(schema.purchases)
    .innerJoin(schema.models, eq(schema.models.id, schema.purchases.modelId))
    .where(and(...where))
    .orderBy(desc(schema.purchases.purchaseDate), asc(schema.models.name));
}

export async function createPurchase(input: {
  tenantId: string; dealerId: string; modelId: string; quantity: number;
  unitDealerPrice: number; unitInvoicePrice: number; purchaseDate: string;
  source: PurchaseSource; referenceNote: string | null; crossRegionTransferId?: string | null;
  reviewStatus?: string; billNumber?: string;
}, executor: Executor = db): Promise<string> {
  const id = randomUUID();
  const billNumber = input.billNumber ?? await getNextBillNumber(input.tenantId, input.dealerId, input.purchaseDate, executor);
  await executor.insert(schema.purchases).values({
    id, ...input,
    billNumber,
    crossRegionTransferId: input.crossRegionTransferId ?? null,
    reviewStatus: input.reviewStatus ?? "active",
  });
  return id;
}

export async function updatePurchase(
  id: string,
  dealerId: string,
  tenantId: string,
  input: {
    quantity: number;
    unitDealerPrice: number;
    unitInvoicePrice: number;
    purchaseDate: string;
    source: PurchaseSource;
  }
): Promise<void> {
  await db
    .update(schema.purchases)
    .set({
      quantity: input.quantity,
      unitDealerPrice: input.unitDealerPrice,
      unitInvoicePrice: input.unitInvoicePrice,
      purchaseDate: input.purchaseDate,
      source: input.source,
    })
    .where(
      and(
        eq(schema.purchases.id, id),
        eq(schema.purchases.dealerId, dealerId),
        eq(schema.purchases.tenantId, tenantId)
      )
    );
}

/**
 * Owner approves a pending-review purchase: flips reviewStatus to APPROVED so it
 * starts counting toward stock and incentives. Returns the row's model/dealer/date
 * for rebate re-evaluation, or null if not found / not pending.
 */
export async function approvePurchaseReview(
  purchaseId: string, tenantId: string
): Promise<{ modelId: string; dealerId: string; purchaseDate: string } | null> {
  const rows = await db
    .select({ modelId: schema.purchases.modelId, dealerId: schema.purchases.dealerId, purchaseDate: schema.purchases.purchaseDate })
    .from(schema.purchases)
    .where(and(
      eq(schema.purchases.id, purchaseId),
      eq(schema.purchases.tenantId, tenantId),
      eq(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW)
    ))
    .limit(1);
  if (rows.length === 0) return null;
  await db.update(schema.purchases)
    .set({ reviewStatus: PURCHASE_REVIEW_STATUS.APPROVED })
    .where(and(eq(schema.purchases.id, purchaseId), eq(schema.purchases.tenantId, tenantId)));
  return rows[0];
}

/** Owner rejects a pending-review purchase: removes it entirely (it was never in stock). */
export async function rejectPurchaseReview(
  purchaseId: string, tenantId: string
): Promise<{ modelId: string; dealerId: string; purchaseDate: string } | null> {
  const rows = await db
    .select({ modelId: schema.purchases.modelId, dealerId: schema.purchases.dealerId, purchaseDate: schema.purchases.purchaseDate })
    .from(schema.purchases)
    .where(and(
      eq(schema.purchases.id, purchaseId),
      eq(schema.purchases.tenantId, tenantId),
      eq(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW)
    ))
    .limit(1);
  if (rows.length === 0) return null;
  await db.delete(schema.purchases)
    .where(and(eq(schema.purchases.id, purchaseId), eq(schema.purchases.tenantId, tenantId)));
  return rows[0];
}

export async function getPurchaseById(id: string, dealerId: string, tenantId: string) {
  const rows = await db
    .select()
    .from(schema.purchases)
    .where(and(eq(schema.purchases.id, id), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deletePurchase(id: string, dealerId: string, tenantId: string, executor: Executor = db): Promise<void> {
  await executor.delete(schema.purchases).where(and(eq(schema.purchases.id, id), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.tenantId, tenantId)));
}

export async function listPurchaseBills(filters: {
  tenantId: string; dealerId: string; modelId?: string; source?: PurchaseSource; from?: string; to?: string;
  page: number; pageSize: number;
}): Promise<{ bills: BillGroup[]; total: number }> {
  const rows = await listPurchases(filters);
  const bills = groupIntoBills(rows);
  const start = (filters.page - 1) * filters.pageSize;
  return { bills: bills.slice(start, start + filters.pageSize), total: bills.length };
}

export interface PurchaseOverviewStats {
  current: PurchaseAggregateStats;
  previous: PurchaseAggregateStats;
  growthPercent: number | null;
  previousLabel: { from: string; to: string };
}

export async function getPurchaseOverviewStats(filters: {
  tenantId: string; dealerId: string; modelId?: string; source?: PurchaseSource; from: string; to: string;
}): Promise<PurchaseOverviewStats> {
  const previousRange = computePreviousPeriod(filters.from, filters.to);
  const [currentRows, previousRows] = await Promise.all([
    listPurchases(filters),
    listPurchases({ ...filters, from: previousRange.from, to: previousRange.to }),
  ]);
  const current = aggregatePurchaseStats(currentRows);
  const previous = aggregatePurchaseStats(previousRows);
  return {
    current,
    previous,
    growthPercent: percentChange(current.totalAmount, previous.totalAmount),
    previousLabel: previousRange,
  };
}

export interface CrShiftedValueResult {
  totalUnits: number;
  totalValue: number;
  byModel: { modelId: string; modelName: string; qty: number; dealerPrice: number; totalValue: number }[];
}

export async function getCrShiftedValue(
  tenantId: string,
  dealerId: string,
  from: string,
  to: string
): Promise<CrShiftedValueResult> {
  const rows = await db
    .select({
      modelId: schema.purchases.modelId,
      modelName: schema.models.name,
      qty: schema.purchases.quantity,
      dealerPrice: schema.purchases.unitDealerPrice,
    })
    .from(schema.purchases)
    .innerJoin(schema.models, eq(schema.models.id, schema.purchases.modelId))
    .where(
      and(
        eq(schema.purchases.tenantId, tenantId),
        eq(schema.purchases.dealerId, dealerId),
        eq(schema.purchases.source, PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN),
        gte(schema.purchases.purchaseDate, from),
        lte(schema.purchases.purchaseDate, to)
      )
    );

  const byModelMap = new Map<string, { modelId: string; modelName: string; qty: number; dealerPrice: number; totalValue: number }>();
  let totalUnits = 0;
  let totalValue = 0;

  for (const r of rows) {
    totalUnits += r.qty;
    const rowValue = r.qty * r.dealerPrice;
    totalValue += rowValue;
    const existing = byModelMap.get(r.modelId);
    if (existing) {
      existing.qty += r.qty;
      existing.totalValue += rowValue;
    } else {
      byModelMap.set(r.modelId, { modelId: r.modelId, modelName: r.modelName, qty: r.qty, dealerPrice: r.dealerPrice, totalValue: rowValue });
    }
  }

  return { totalUnits, totalValue, byModel: [...byModelMap.values()] };
}

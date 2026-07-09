import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getPriceOnDate } from "./models";
import { PURCHASE_SOURCE } from "@/lib/constants";
import {
  aggregateActivationStats,
  groupActivationsByDate,
  type ActivationAggregateStats,
  type ActivationDateGroup,
  type ActivationStatsRow,
} from "@/lib/activations/activation-stats";
import { computePreviousPeriod, percentChange } from "@/lib/purchases/purchase-stats";
import { buildIncentiveReport } from "@/lib/incentive-engine/loader";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** After any activation create/delete, recompute isCrossRegion for all activations of this model/dealer.
 *  FIFO rule: regular stock consumed first; the most-recent excess activations are auto-tagged CR. */
async function recalculateCrTagsForModel(tenantId: string, dealerId: string, modelId: string, executor: Executor = db): Promise<void> {
  // Regular purchased qty (excludes CR transfers)
  const [{ regularQty }] = await executor
    .select({ regularQty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
    .from(schema.purchases)
    .where(
      and(
        eq(schema.purchases.tenantId, tenantId),
        eq(schema.purchases.dealerId, dealerId),
        eq(schema.purchases.modelId, modelId),
        sql`${schema.purchases.source} != ${PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN}`
      )
    );

  const regular = Number(regularQty);

  // All activations for this model, oldest first
  const all = await executor
    .select({ id: schema.activations.id })
    .from(schema.activations)
    .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.modelId, modelId)))
    .orderBy(asc(schema.activations.activationDate), asc(schema.activations.createdAt));

  if (all.length === 0) return;

  const regularIds = all.slice(0, regular).map((r) => r.id);
  const crIds = all.slice(regular).map((r) => r.id);

  if (regularIds.length > 0) {
    await executor
      .update(schema.activations)
      .set({ isCrossRegion: false })
      .where(sql`${schema.activations.id} IN (${sql.join(regularIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  if (crIds.length > 0) {
    await executor
      .update(schema.activations)
      .set({ isCrossRegion: true })
      .where(sql`${schema.activations.id} IN (${sql.join(crIds.map((id) => sql`${id}`), sql`, `)})`);
  }
}

export interface ActivationRow {
  id: string;
  modelId: string;
  modelName: string;
  imei: string | null;
  activationDate: string;
  dealerPriceSnapshot: number;
  isCrossRegion: boolean;
  purchaseId: string | null;
}

export async function listActivations(filters: {
  tenantId: string;
  dealerId: string;
  modelId?: string;
  from?: string;
  to?: string;
}): Promise<ActivationRow[]> {
  const where = [
    eq(schema.activations.tenantId, filters.tenantId),
    eq(schema.activations.dealerId, filters.dealerId),
  ];
  if (filters.modelId) where.push(eq(schema.activations.modelId, filters.modelId));
  if (filters.from) where.push(gte(schema.activations.activationDate, filters.from));
  if (filters.to) where.push(lte(schema.activations.activationDate, filters.to));

  const rows = await db
    .select({
      id: schema.activations.id,
      modelId: schema.activations.modelId,
      modelName: schema.models.name,
      imei: schema.activations.imei,
      activationDate: schema.activations.activationDate,
      dealerPriceSnapshot: schema.activations.dealerPriceSnapshot,
      isCrossRegion: schema.activations.isCrossRegion,
      purchaseId: schema.activations.purchaseId,
    })
    .from(schema.activations)
    .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
    .where(and(...where))
    .orderBy(desc(schema.activations.activationDate), asc(schema.models.name));
  return rows;
}

export async function createActivation(
  input: {
    tenantId: string;
    dealerId: string;
    modelId: string;
    activationDate: string;
    imei: string | null;
    purchaseId: string | null;
    isCrossRegion: boolean;
    dealerPriceOverride?: number;
  },
  executor: Executor = db,
): Promise<{ id: string; pricedAt: number; isCrossRegion: boolean }> {
  const id = randomUUID();
  let snapshot = input.dealerPriceOverride;
  if (snapshot == null) {
    const price = await getPriceOnDate(input.tenantId, input.modelId, input.activationDate);
    if (!price) throw new Error("No dealer price defined for this model on or before the activation date");
    snapshot = price.dealerPrice;
  }
  let isCrossRegion = input.isCrossRegion;
  if (input.purchaseId) {
    const linked = await executor
      .select()
      .from(schema.purchases)
      .where(and(eq(schema.purchases.id, input.purchaseId), eq(schema.purchases.tenantId, input.tenantId)))
      .limit(1);
    if (linked.length > 0 && linked[0].source === "CROSS_REGION_TRANSFER_IN") isCrossRegion = true;
  }
  await executor.insert(schema.activations).values({
    id,
    tenantId: input.tenantId,
    dealerId: input.dealerId,
    modelId: input.modelId,
    activationDate: input.activationDate,
    imei: input.imei,
    purchaseId: input.purchaseId,
    isCrossRegion,
    dealerPriceSnapshot: snapshot,
  });
  // Auto-correct CR tags unless the caller already resolved via purchase link
  if (!input.purchaseId) {
    await recalculateCrTagsForModel(input.tenantId, input.dealerId, input.modelId, executor);
  }
  // Re-read the final isCrossRegion value after recalculation
  const saved = await executor.select({ isCrossRegion: schema.activations.isCrossRegion }).from(schema.activations).where(eq(schema.activations.id, id)).limit(1);
  const finalCr = saved[0]?.isCrossRegion ?? isCrossRegion;
  return { id, pricedAt: snapshot, isCrossRegion: finalCr };
}

export async function updateActivation(
  id: string,
  dealerId: string,
  tenantId: string,
  input: {
    activationDate: string;
    imei: string | null;
    isCrossRegion: boolean;
    dealerPriceSnapshot: number;
  },
  executor: Executor = db
): Promise<void> {
  await executor
    .update(schema.activations)
    .set({
      activationDate: input.activationDate,
      imei: input.imei,
      isCrossRegion: input.isCrossRegion,
      dealerPriceSnapshot: input.dealerPriceSnapshot,
    })
    .where(
      and(
        eq(schema.activations.id, id),
        eq(schema.activations.dealerId, dealerId),
        eq(schema.activations.tenantId, tenantId)
      )
    );
}

export async function getActivationById(id: string, dealerId: string, tenantId: string) {
  const rows = await db
    .select()
    .from(schema.activations)
    .where(and(eq(schema.activations.id, id), eq(schema.activations.dealerId, dealerId), eq(schema.activations.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteActivation(id: string, dealerId: string, tenantId: string): Promise<void> {
  // Fetch modelId before deleting so we can recalculate CR tags after
  const rows = await db.select({ modelId: schema.activations.modelId }).from(schema.activations)
    .where(and(eq(schema.activations.id, id), eq(schema.activations.dealerId, dealerId), eq(schema.activations.tenantId, tenantId))).limit(1);
  await db
    .delete(schema.activations)
    .where(
      and(
        eq(schema.activations.id, id),
        eq(schema.activations.dealerId, dealerId),
        eq(schema.activations.tenantId, tenantId)
      )
    );
  if (rows.length > 0) {
    await recalculateCrTagsForModel(tenantId, dealerId, rows[0].modelId);
  }
}

export interface ActivationTargetProgress {
  targetQty: number | null;
  actualQty: number;
  /** actual / target as a percentage, one decimal. null when no target is set. */
  percent: number | null;
  bonusPercent: number;
  eligible: boolean;
}

export interface ActivationOverviewStats {
  current: ActivationAggregateStats;
  previous: ActivationAggregateStats;
  growthPercent: number | null;
  previousLabel: { from: string; to: string };
  /** Base 4% incentive earned in the period (engine, centralized). */
  baseIncentiveEarned: number;
  /** All incentive components earned in the period (base + bonus + policies + stock-in). */
  totalIncentiveEarned: number;
  targetProgress: ActivationTargetProgress;
  /** All-time: how much received stock has been activated. */
  sellThrough: { activatedAllTime: number; receivedAllTime: number; percent: number | null };
  /** Day-wise groups (newest first) for the activation timeline. */
  timeline: ActivationDateGroup[];
}

/** All-time counts for sell-through: activated units vs total stock ever received
 *  (received = all purchases, incl. accepted cross-region transfers — per stock formula). */
async function getSellThroughCounts(tenantId: string, dealerId: string): Promise<{ activated: number; received: number }> {
  const [act] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.activations)
    .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId)));
  const [pur] = await db
    .select({ n: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId)));
  return { activated: Number(act.n), received: Number(pur.n) };
}

export async function getActivationOverviewStats(filters: {
  tenantId: string;
  dealerId: string;
  modelId?: string;
  from: string;
  to: string;
}): Promise<ActivationOverviewStats> {
  const previousRange = computePreviousPeriod(filters.from, filters.to);
  const toStatsRows = (rows: ActivationRow[]): ActivationStatsRow[] =>
    rows.map((r) => ({
      modelId: r.modelId,
      modelName: r.modelName,
      activationDate: r.activationDate,
      dealerPriceSnapshot: r.dealerPriceSnapshot,
      isCrossRegion: r.isCrossRegion,
    }));

  const [currentRows, previousRows, report, allTime] = await Promise.all([
    listActivations({ tenantId: filters.tenantId, dealerId: filters.dealerId, modelId: filters.modelId, from: filters.from, to: filters.to }),
    listActivations({ tenantId: filters.tenantId, dealerId: filters.dealerId, modelId: filters.modelId, from: previousRange.from, to: previousRange.to }),
    buildIncentiveReport({ dealerId: filters.dealerId, periodStart: filters.from, periodEnd: filters.to, dataTenantId: filters.tenantId }),
    getSellThroughCounts(filters.tenantId, filters.dealerId),
  ]);

  const currentStatsRows = toStatsRows(currentRows);
  const current = aggregateActivationStats(currentStatsRows);
  const previous = aggregateActivationStats(toStatsRows(previousRows));

  const { targetQty, actualQty, bonusPercent, eligible } = report.targetBonus;

  return {
    current,
    previous,
    growthPercent: percentChange(current.totalActivations, previous.totalActivations),
    previousLabel: previousRange,
    baseIncentiveEarned: report.totals.basePercentEarned,
    totalIncentiveEarned: report.totals.grandTotal,
    targetProgress: {
      targetQty,
      actualQty,
      percent: targetQty && targetQty > 0 ? Math.round((actualQty / targetQty) * 1000) / 10 : null,
      bonusPercent,
      eligible,
    },
    sellThrough: {
      activatedAllTime: allTime.activated,
      receivedAllTime: allTime.received,
      percent: allTime.received > 0 ? Math.round((allTime.activated / allTime.received) * 1000) / 10 : null,
    },
    timeline: groupActivationsByDate(currentStatsRows),
  };
}

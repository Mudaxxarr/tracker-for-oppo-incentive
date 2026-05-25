import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getStockForModelAsOf } from "./purchases";

export interface RebateRow {
  id: string;
  tenantId: string;
  dealerId: string;
  dealerName: string;
  modelId: string;
  modelName: string;
  priceHistoryId: string | null;
  oldDealerPrice: number;
  newDealerPrice: number;
  rebatePerUnit: number;
  eligibleQty: number;
  totalRebateAmount: number;
  rebateDate: string;
}

export async function listRebatesForModel(tenantId: string, modelId: string): Promise<RebateRow[]> {
  return db
    .select({
      id: schema.rebates.id,
      tenantId: schema.rebates.tenantId,
      dealerId: schema.rebates.dealerId,
      dealerName: schema.dealerIds.name,
      modelId: schema.rebates.modelId,
      modelName: schema.models.name,
      priceHistoryId: schema.rebates.priceHistoryId,
      oldDealerPrice: schema.rebates.oldDealerPrice,
      newDealerPrice: schema.rebates.newDealerPrice,
      rebatePerUnit: schema.rebates.rebatePerUnit,
      eligibleQty: schema.rebates.eligibleQty,
      totalRebateAmount: schema.rebates.totalRebateAmount,
      rebateDate: schema.rebates.rebateDate,
    })
    .from(schema.rebates)
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.rebates.dealerId))
    .innerJoin(schema.models, eq(schema.models.id, schema.rebates.modelId))
    .where(and(eq(schema.rebates.tenantId, tenantId), eq(schema.rebates.modelId, modelId)))
    .orderBy(desc(schema.rebates.rebateDate));
}

export async function listRebatesForDealer(tenantId: string, dealerId: string): Promise<RebateRow[]> {
  return db
    .select({
      id: schema.rebates.id,
      tenantId: schema.rebates.tenantId,
      dealerId: schema.rebates.dealerId,
      dealerName: schema.dealerIds.name,
      modelId: schema.rebates.modelId,
      modelName: schema.models.name,
      priceHistoryId: schema.rebates.priceHistoryId,
      oldDealerPrice: schema.rebates.oldDealerPrice,
      newDealerPrice: schema.rebates.newDealerPrice,
      rebatePerUnit: schema.rebates.rebatePerUnit,
      eligibleQty: schema.rebates.eligibleQty,
      totalRebateAmount: schema.rebates.totalRebateAmount,
      rebateDate: schema.rebates.rebateDate,
    })
    .from(schema.rebates)
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.rebates.dealerId))
    .innerJoin(schema.models, eq(schema.models.id, schema.rebates.modelId))
    .where(and(eq(schema.rebates.tenantId, tenantId), eq(schema.rebates.dealerId, dealerId)))
    .orderBy(desc(schema.rebates.rebateDate));
}

export async function listRebatesForDealerInPeriod(
  tenantId: string,
  dealerId: string,
  from: string,
  to: string
): Promise<RebateRow[]> {
  return db
    .select({
      id: schema.rebates.id,
      tenantId: schema.rebates.tenantId,
      dealerId: schema.rebates.dealerId,
      dealerName: schema.dealerIds.name,
      modelId: schema.rebates.modelId,
      modelName: schema.models.name,
      priceHistoryId: schema.rebates.priceHistoryId,
      oldDealerPrice: schema.rebates.oldDealerPrice,
      newDealerPrice: schema.rebates.newDealerPrice,
      rebatePerUnit: schema.rebates.rebatePerUnit,
      eligibleQty: schema.rebates.eligibleQty,
      totalRebateAmount: schema.rebates.totalRebateAmount,
      rebateDate: schema.rebates.rebateDate,
    })
    .from(schema.rebates)
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.rebates.dealerId))
    .innerJoin(schema.models, eq(schema.models.id, schema.rebates.modelId))
    .where(
      and(
        eq(schema.rebates.tenantId, tenantId),
        eq(schema.rebates.dealerId, dealerId),
        gte(schema.rebates.rebateDate, from),
        lte(schema.rebates.rebateDate, to)
      )
    )
    .orderBy(desc(schema.rebates.rebateDate));
}

export async function sumRebatesForPeriod(
  tenantId: string,
  dealerId: string,
  from: string,
  to: string
): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.rebates.totalRebateAmount}), 0)` })
    .from(schema.rebates)
    .where(
      and(
        eq(schema.rebates.tenantId, tenantId),
        eq(schema.rebates.dealerId, dealerId),
        sql`${schema.rebates.rebateDate} >= ${from}`,
        sql`${schema.rebates.rebateDate} <= ${to}`
      )
    );
  return Number(total);
}

/** Called when a model's dealer price drops. Creates one rebate record per owner dealer ID that has stock. */
export async function createRebatesForPriceDrop(input: {
  tenantId: string;
  modelId: string;
  oldDealerPrice: number;
  newDealerPrice: number;
  rebateDate: string;
  priceHistoryId?: string | null;
}): Promise<{ dealersAffected: number; totalRebate: number }> {
  const rebatePerUnit = input.oldDealerPrice - input.newDealerPrice;
  if (rebatePerUnit <= 0) return { dealersAffected: 0, totalRebate: 0 };

  const dealerIds = await db
    .select({ id: schema.dealerIds.id })
    .from(schema.dealerIds)
    .where(eq(schema.dealerIds.tenantId, input.tenantId));

  let dealersAffected = 0;
  let totalRebate = 0;

  for (const { id: dealerId } of dealerIds) {
    // Use the same stock formula as the rest of the app: purchases - activations - transfers_out - cr_caught
    const eligibleQty = await getStockForModelAsOf(input.tenantId, dealerId, input.modelId, input.rebateDate);
    if (eligibleQty <= 0) continue;
    const total = eligibleQty * rebatePerUnit;
    await db.insert(schema.rebates).values({
      id: randomUUID(),
      tenantId: input.tenantId,
      dealerId,
      modelId: input.modelId,
      oldDealerPrice: input.oldDealerPrice,
      newDealerPrice: input.newDealerPrice,
      rebatePerUnit,
      eligibleQty,
      totalRebateAmount: total,
      rebateDate: input.rebateDate,
      priceHistoryId: input.priceHistoryId ?? null,
    });
    dealersAffected++;
    totalRebate += total;
  }

  return { dealersAffected, totalRebate };
}

/**
 * After editing a price entry at Date X, re-evaluates rebates for every entry
 * from Date X through the current date. Handles three outcomes per entry:
 *   - Drop vs preceding entry and no rebate yet  → create
 *   - Drop vs preceding entry but stale amounts  → delete + recreate
 *   - No drop (increase/flat) or no preceding    → delete any existing rebate
 */
export async function reEvaluateRebatesFromEntry(
  tenantId: string,
  modelId: string,
  fromPriceHistoryId: string
): Promise<void> {
  const allEntries = await db
    .select({
      id: schema.modelPriceHistory.id,
      dealerPrice: schema.modelPriceHistory.dealerPrice,
      effectiveFrom: schema.modelPriceHistory.effectiveFrom,
    })
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.tenantId, tenantId), eq(schema.modelPriceHistory.modelId, modelId)))
    .orderBy(asc(schema.modelPriceHistory.effectiveFrom));

  const startIdx = allEntries.findIndex((e) => e.id === fromPriceHistoryId);
  if (startIdx === -1) return;

  for (let i = startIdx; i < allEntries.length; i++) {
    const curr = allEntries[i];
    const prev = i > 0 ? allEntries[i - 1] : null;

    if (prev !== null && prev.dealerPrice > curr.dealerPrice) {
      const existing = await db
        .select({ oldDealerPrice: schema.rebates.oldDealerPrice, newDealerPrice: schema.rebates.newDealerPrice })
        .from(schema.rebates)
        .where(and(eq(schema.rebates.tenantId, tenantId), eq(schema.rebates.priceHistoryId, curr.id)));

      const stale =
        existing.length === 0 ||
        existing[0].oldDealerPrice !== prev.dealerPrice ||
        existing[0].newDealerPrice !== curr.dealerPrice;

      if (stale) {
        await db.delete(schema.rebates).where(
          and(eq(schema.rebates.tenantId, tenantId), eq(schema.rebates.priceHistoryId, curr.id))
        );
        await createRebatesForPriceDrop({
          tenantId,
          modelId,
          oldDealerPrice: prev.dealerPrice,
          newDealerPrice: curr.dealerPrice,
          rebateDate: curr.effectiveFrom,
          priceHistoryId: curr.id,
        });
      }
    } else {
      await db.delete(schema.rebates).where(
        and(eq(schema.rebates.tenantId, tenantId), eq(schema.rebates.priceHistoryId, curr.id))
      );
    }
  }
}

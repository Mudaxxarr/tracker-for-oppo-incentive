import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getClosingStockBeforeDate } from "./purchases";

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

/**
 * Re-evaluates rebates for a single dealer+model from `fromDate` forward.
 * Called whenever an activation is created, updated, or deleted — ensuring
 * that changing a unit's activation date does not leave stale rebate records.
 */
export async function reEvaluateRebatesForDealer(
  priceTenantId: string,
  dealerId: string,
  modelId: string,
  fromDate: string,
  stockTenantId?: string
): Promise<void> {
  const dataTenantId = stockTenantId ?? priceTenantId;
  const allEntries = await db
    .select({
      id: schema.modelPriceHistory.id,
      dealerPrice: schema.modelPriceHistory.dealerPrice,
      effectiveFrom: schema.modelPriceHistory.effectiveFrom,
    })
    .from(schema.modelPriceHistory)
    .where(
      and(
        eq(schema.modelPriceHistory.tenantId, priceTenantId),
        eq(schema.modelPriceHistory.modelId, modelId)
      )
    )
    .orderBy(asc(schema.modelPriceHistory.effectiveFrom));

  // Central pricing can come from the owner while the dealer's stock and
  // adjustment ledger belong to another tenant. Older queue runs incorrectly
  // stored those cross-tenant rows under the price tenant; remove them before
  // rebuilding the dealer-owned rows below.
  if (dataTenantId !== priceTenantId) {
    await db.delete(schema.rebates).where(
      and(
        eq(schema.rebates.tenantId, priceTenantId),
        eq(schema.rebates.dealerId, dealerId),
        eq(schema.rebates.modelId, modelId)
      )
    );
  }

  // Purge any orphan rebates with no price-history anchor (NULL priceHistoryId)
  // eq() generates col = value which never matches NULL, so these would survive
  // the loop's delete passes and permanently over-report rebate income.
  await db.delete(schema.rebates).where(
    and(
      eq(schema.rebates.tenantId, dataTenantId),
      eq(schema.rebates.dealerId, dealerId),
      eq(schema.rebates.modelId, modelId),
      isNull(schema.rebates.priceHistoryId)
    )
  );

  const startIdx = allEntries.findIndex((e) => e.effectiveFrom >= fromDate);
  if (startIdx === -1) return;

  for (let i = startIdx; i < allEntries.length; i++) {
    const curr = allEntries[i];
    const prev = i > 0 ? allEntries[i - 1] : null;

    if (prev !== null && prev.dealerPrice > curr.dealerPrice) {
      const rebatePerUnit = prev.dealerPrice - curr.dealerPrice;
      const eligibleQty = await getClosingStockBeforeDate(dataTenantId, dealerId, modelId, curr.effectiveFrom);

      await db.delete(schema.rebates).where(
        and(
          eq(schema.rebates.tenantId, dataTenantId),
          eq(schema.rebates.priceHistoryId, curr.id),
          eq(schema.rebates.dealerId, dealerId)
        )
      );

      if (eligibleQty > 0) {
        await db.insert(schema.rebates).values({
          id: randomUUID(),
          tenantId: dataTenantId,
          dealerId,
          modelId,
          oldDealerPrice: prev.dealerPrice,
          newDealerPrice: curr.dealerPrice,
          rebatePerUnit,
          eligibleQty,
          totalRebateAmount: eligibleQty * rebatePerUnit,
          rebateDate: curr.effectiveFrom,
          priceHistoryId: curr.id,
        });
      }
    } else {
      await db.delete(schema.rebates).where(
        and(
          eq(schema.rebates.tenantId, dataTenantId),
          eq(schema.rebates.priceHistoryId, curr.id),
          eq(schema.rebates.dealerId, dealerId)
        )
      );
    }
  }
}

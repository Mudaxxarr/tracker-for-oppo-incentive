import "server-only";
import { db, schema } from "@/lib/db/client";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { and, eq, gte, lte, ne, or, type SQL } from "drizzle-orm";
import { calculateIncentives, type EngineInput, type IncentiveReport } from "./index";
import { getConstants } from "@/lib/settings";
import { PURCHASE_REVIEW_STATUS } from "@/lib/constants";

/**
 * Loads everything the engine needs for a (dealerId, period) and produces a report.
 *
 * The engine needs activations and purchases that fall in the union of:
 *  - the report period itself
 *  - any policy windows for that dealer (so target gating uses correct counts)
 *
 * For simplicity we fetch all activations/purchases for the dealer that overlap
 * any policy's window OR the report's window.
 */
export async function buildIncentiveReport(input: {
  dealerId: string;
  periodStart: string;
  periodEnd: string;
  baseIncentivePercent?: number;
  /** tenantId for data queries (activations, purchases). Defaults to OWNER_TENANT_ID for the main app. Pass the dealer's tenantId for the dealer portal. */
  dataTenantId?: string;
}): Promise<IncentiveReport> {
  const { dealerId, periodStart, periodEnd } = input;
  const constants = await getConstants();
  const basePct = input.baseIncentivePercent ?? constants.basePercent;

  const tenantId = OWNER_TENANT_ID;
  const dataTenantId = input.dataTenantId ?? OWNER_TENANT_ID;

  const [
    models,
    targetBonusPolicies,
    stockInPolicies,
    activationIncentivePolicies,
    dealerIncentivePolicies,
  ] = await Promise.all([
    db.select().from(schema.models),
    db
      .select()
      .from(schema.targetBonusPolicies)
      .where(and(eq(schema.targetBonusPolicies.tenantId, tenantId), eq(schema.targetBonusPolicies.dealerId, dealerId))),
    db
      .select()
      .from(schema.stockInPolicies)
      .where(and(eq(schema.stockInPolicies.tenantId, tenantId), eq(schema.stockInPolicies.dealerId, dealerId))),
    db
      .select()
      .from(schema.activationIncentivePolicies)
      .where(and(eq(schema.activationIncentivePolicies.tenantId, tenantId), eq(schema.activationIncentivePolicies.dealerId, dealerId))),
    db
      .select()
      .from(schema.dealerIncentivePolicies)
      .where(and(eq(schema.dealerIncentivePolicies.tenantId, tenantId), eq(schema.dealerIncentivePolicies.dealerId, dealerId))),
  ]);

  // Compute the full window (union) of report + all policy windows.
  let minStart = periodStart;
  let maxEnd = periodEnd;
  const apply = (start: string, end: string) => {
    if (start < minStart) minStart = start;
    if (end > maxEnd) maxEnd = end;
  };
  for (const p of targetBonusPolicies) apply(p.periodStart, p.periodEnd);
  for (const p of stockInPolicies) apply(p.periodStart, p.periodEnd);
  for (const p of activationIncentivePolicies) apply(p.periodStart, p.periodEnd);
  for (const p of dealerIncentivePolicies) apply(p.periodStart, p.periodEnd);

  const [activations, purchases, interIdOut] = await Promise.all([
    db
      .select()
      .from(schema.activations)
      .where(
        and(
          eq(schema.activations.tenantId, dataTenantId),
          eq(schema.activations.dealerId, dealerId),
          gte(schema.activations.activationDate, minStart),
          lte(schema.activations.activationDate, maxEnd)
        ) as SQL
      ),
    db
      .select()
      .from(schema.purchases)
      .where(
        and(
          eq(schema.purchases.tenantId, dataTenantId),
          eq(schema.purchases.dealerId, dealerId),
          gte(schema.purchases.purchaseDate, minStart),
          lte(schema.purchases.purchaseDate, maxEnd),
          ne(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW)
        ) as SQL
      ),
    db
      .select()
      .from(schema.interIdTransfers)
      .where(
        and(
          eq(schema.interIdTransfers.tenantId, dataTenantId),
          eq(schema.interIdTransfers.fromDealerId, dealerId),
          gte(schema.interIdTransfers.transferDate, minStart),
          lte(schema.interIdTransfers.transferDate, maxEnd)
        ) as SQL
      ),
  ]);

  const engineInput: EngineInput = {
    dealerId,
    periodStart,
    periodEnd,
    baseIncentivePercent: basePct,
    models: models.map((m) => ({ id: m.id, name: m.name })),
    activations: activations.map((a) => ({
      id: a.id,
      modelId: a.modelId,
      activationDate: a.activationDate,
      dealerPriceSnapshot: a.dealerPriceSnapshot,
      isCrossRegion: a.isCrossRegion,
    })),
    purchases: purchases.map((p) => ({
      id: p.id,
      modelId: p.modelId,
      quantity: p.quantity,
      unitDealerPrice: p.unitDealerPrice,
      purchaseDate: p.purchaseDate,
      source: p.source as "REGULAR" | "CROSS_REGION_TRANSFER_IN",
    })),
    targetBonusPolicies,
    stockInPolicies: stockInPolicies.map((p) => ({
      id: p.id,
      modelId: p.modelId,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      perUnitAmount: p.perUnitAmount,
      minQty: p.minQty,
    })),
    activationIncentivePolicies: activationIncentivePolicies.map((p) => ({
      id: p.id,
      modelId: p.modelId,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      perUnitAmount: p.perUnitAmount,
      targetQty: p.targetQty,
    })),
    dealerIncentivePolicies,
    interIdOut: interIdOut.map((t) => ({
      id: t.id,
      modelId: t.modelId,
      quantity: t.quantity,
      transferDate: t.transferDate,
    })),
  };

  // Suppress unused param warning on `or` import (kept for future filter expansion)
  void or;

  return calculateIncentives(engineInput);
}

export async function buildLastSixMonths(
  dealerId: string,
  dataTenantId?: string,
): Promise<Array<{ label: string; total: number; activations: number }>> {
  const PKT = 5 * 3600 * 1000;
  const todayPKT = new Date(Date.now() + PKT);
  const [yr, mo] = todayPKT.toISOString().slice(0, 7).split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const months = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const rawMo = mo - offset;
    const adjMo = ((rawMo - 1 + 120) % 12) + 1;
    const adjYr = yr + Math.floor((rawMo - 1) / 12);
    const endDay = new Date(Date.UTC(adjYr, adjMo, 0)).getUTCDate();
    return {
      label: new Date(Date.UTC(adjYr, adjMo - 1, 1)).toLocaleString("en-US", { month: "short" }),
      startStr: `${adjYr}-${pad(adjMo)}-01`,
      endStr: `${adjYr}-${pad(adjMo)}-${pad(endDay)}`,
    };
  });

  return buildMonthlyEarnings(dealerId, months, dataTenantId);
}

/**
 * Batched version of calling buildIncentiveReport once per month: one query
 * round-trip for policies/activations/purchases/transfers across the whole
 * month range, then calculateIncentives (pure, in-memory) per month — instead
 * of N independent full re-queries. Callers supply their own month
 * boundaries so existing month-labeling behavior (e.g. server-local-time vs
 * PKT) is unaffected by this shared helper.
 */
export async function buildMonthlyEarnings(
  dealerId: string,
  months: Array<{ label: string; startStr: string; endStr: string }>,
  dataTenantId?: string,
): Promise<Array<{ label: string; total: number; activations: number }>> {
  const tenantId = OWNER_TENANT_ID;
  const effectiveDataTenantId = dataTenantId ?? OWNER_TENANT_ID;

  const rangeStart = months[0].startStr;
  const rangeEnd = months[months.length - 1].endStr;

  // Fetch constants + all policies + models in one parallel batch
  const [
    constants,
    models,
    targetBonusPolicies,
    stockInPolicies,
    activationIncentivePolicies,
    dealerIncentivePolicies,
  ] = await Promise.all([
    getConstants(),
    db.select().from(schema.models),
    db.select().from(schema.targetBonusPolicies).where(and(eq(schema.targetBonusPolicies.tenantId, tenantId), eq(schema.targetBonusPolicies.dealerId, dealerId))),
    db.select().from(schema.stockInPolicies).where(and(eq(schema.stockInPolicies.tenantId, tenantId), eq(schema.stockInPolicies.dealerId, dealerId))),
    db.select().from(schema.activationIncentivePolicies).where(and(eq(schema.activationIncentivePolicies.tenantId, tenantId), eq(schema.activationIncentivePolicies.dealerId, dealerId))),
    db.select().from(schema.dealerIncentivePolicies).where(and(eq(schema.dealerIncentivePolicies.tenantId, tenantId), eq(schema.dealerIncentivePolicies.dealerId, dealerId))),
  ]);

  // Extend window to cover all policy gates (so target/dealer-incentive counts are correct)
  let minStart = rangeStart;
  let maxEnd = rangeEnd;
  const extend = (s: string, e: string) => {
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  };
  for (const p of targetBonusPolicies) extend(p.periodStart, p.periodEnd);
  for (const p of stockInPolicies) extend(p.periodStart, p.periodEnd);
  for (const p of activationIncentivePolicies) extend(p.periodStart, p.periodEnd);
  for (const p of dealerIncentivePolicies) extend(p.periodStart, p.periodEnd);

  // Fetch all transactional data for the full extended range in one batch
  const [activations, purchases, interIdOut] = await Promise.all([
    db.select().from(schema.activations).where(
      and(eq(schema.activations.tenantId, effectiveDataTenantId), eq(schema.activations.dealerId, dealerId), gte(schema.activations.activationDate, minStart), lte(schema.activations.activationDate, maxEnd))
    ),
    db.select().from(schema.purchases).where(
      and(eq(schema.purchases.tenantId, effectiveDataTenantId), eq(schema.purchases.dealerId, dealerId), gte(schema.purchases.purchaseDate, minStart), lte(schema.purchases.purchaseDate, maxEnd), ne(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW))
    ),
    db.select().from(schema.interIdTransfers).where(
      and(eq(schema.interIdTransfers.tenantId, effectiveDataTenantId), eq(schema.interIdTransfers.fromDealerId, dealerId), gte(schema.interIdTransfers.transferDate, minStart), lte(schema.interIdTransfers.transferDate, maxEnd))
    ),
  ]);

  const engineBase = {
    dealerId,
    baseIncentivePercent: constants.basePercent,
    models: models.map((m) => ({ id: m.id, name: m.name })),
    activations: activations.map((a) => ({
      id: a.id, modelId: a.modelId, activationDate: a.activationDate,
      dealerPriceSnapshot: a.dealerPriceSnapshot, isCrossRegion: a.isCrossRegion,
    })),
    purchases: purchases.map((p) => ({
      id: p.id, modelId: p.modelId, quantity: p.quantity,
      unitDealerPrice: p.unitDealerPrice, purchaseDate: p.purchaseDate,
      source: p.source as "REGULAR" | "CROSS_REGION_TRANSFER_IN",
    })),
    targetBonusPolicies,
    stockInPolicies: stockInPolicies.map((p) => ({
      id: p.id, modelId: p.modelId, periodStart: p.periodStart,
      periodEnd: p.periodEnd, perUnitAmount: p.perUnitAmount, minQty: p.minQty,
    })),
    activationIncentivePolicies: activationIncentivePolicies.map((p) => ({
      id: p.id, modelId: p.modelId, periodStart: p.periodStart,
      periodEnd: p.periodEnd, perUnitAmount: p.perUnitAmount, targetQty: p.targetQty,
    })),
    dealerIncentivePolicies,
    interIdOut: interIdOut.map((t) => ({
      id: t.id, modelId: t.modelId, quantity: t.quantity, transferDate: t.transferDate,
    })),
  };

  // Pure in-memory calculation per month — no additional DB I/O
  return months.map((m) => {
    const report = calculateIncentives({ ...engineBase, periodStart: m.startStr, periodEnd: m.endStr });
    return { label: m.label, total: report.totals.grandTotal, activations: report.totalActivations };
  });
}

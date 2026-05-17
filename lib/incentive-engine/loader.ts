import "server-only";
import { db, schema } from "@/lib/db/client";
import { and, eq, gte, lte, or, type SQL } from "drizzle-orm";
import { calculateIncentives, type EngineInput, type IncentiveReport } from "./index";
import { getConstants } from "@/lib/settings";

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
}): Promise<IncentiveReport> {
  const { dealerId, periodStart, periodEnd } = input;
  const constants = await getConstants();
  const basePct = input.baseIncentivePercent ?? constants.basePercent;

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
      .where(eq(schema.targetBonusPolicies.dealerId, dealerId)),
    db
      .select()
      .from(schema.stockInPolicies)
      .where(eq(schema.stockInPolicies.dealerId, dealerId)),
    db
      .select()
      .from(schema.activationIncentivePolicies)
      .where(eq(schema.activationIncentivePolicies.dealerId, dealerId)),
    db
      .select()
      .from(schema.dealerIncentivePolicies)
      .where(eq(schema.dealerIncentivePolicies.dealerId, dealerId)),
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
          eq(schema.purchases.dealerId, dealerId),
          gte(schema.purchases.purchaseDate, minStart),
          lte(schema.purchases.purchaseDate, maxEnd)
        ) as SQL
      ),
    db
      .select()
      .from(schema.interIdTransfers)
      .where(
        and(
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

export async function buildLastSixMonths(dealerId: string): Promise<
  Array<{ label: string; total: number; activations: number }>
> {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return {
      label: start.toLocaleString("en-US", { month: "short" }),
      startStr: start.toISOString().slice(0, 10),
      endStr: end.toISOString().slice(0, 10),
    };
  });

  const reports = await Promise.all(
    months.map((m) =>
      buildIncentiveReport({ dealerId, periodStart: m.startStr, periodEnd: m.endStr })
    )
  );

  return months.map((m, i) => ({
    label: m.label,
    total: reports[i].totals.grandTotal,
    activations: reports[i].totalActivations,
  }));
}

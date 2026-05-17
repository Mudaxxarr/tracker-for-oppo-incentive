import "server-only";
import { db, schema } from "@/lib/db/client";
import { and, eq, lte, gte } from "drizzle-orm";
import type { IncentiveReport } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "./report-types";

export type { PolicyAchievementEntry } from "./report-types";

export async function buildPolicyAchievements(
  dealerId: string,
  periodStart: string,
  periodEnd: string,
  report: IncentiveReport
): Promise<PolicyAchievementEntry[]> {
  const [targetBonusPolicies, stockInPolicies, activationIncentivePolicies, dealerIncentivePolicies] =
    await Promise.all([
      db.select().from(schema.targetBonusPolicies).where(and(
        eq(schema.targetBonusPolicies.dealerId, dealerId),
        lte(schema.targetBonusPolicies.periodStart, periodEnd),
        gte(schema.targetBonusPolicies.periodEnd, periodStart),
      )),
      db.select({
        id: schema.stockInPolicies.id,
        modelId: schema.stockInPolicies.modelId,
        modelName: schema.models.name,
        periodStart: schema.stockInPolicies.periodStart,
        periodEnd: schema.stockInPolicies.periodEnd,
        perUnitAmount: schema.stockInPolicies.perUnitAmount,
        minQty: schema.stockInPolicies.minQty,
      })
        .from(schema.stockInPolicies)
        .innerJoin(schema.models, eq(schema.models.id, schema.stockInPolicies.modelId))
        .where(and(
          eq(schema.stockInPolicies.dealerId, dealerId),
          lte(schema.stockInPolicies.periodStart, periodEnd),
          gte(schema.stockInPolicies.periodEnd, periodStart),
        )),
      db.select({
        id: schema.activationIncentivePolicies.id,
        modelId: schema.activationIncentivePolicies.modelId,
        modelName: schema.models.name,
        periodStart: schema.activationIncentivePolicies.periodStart,
        periodEnd: schema.activationIncentivePolicies.periodEnd,
        perUnitAmount: schema.activationIncentivePolicies.perUnitAmount,
        targetQty: schema.activationIncentivePolicies.targetQty,
      })
        .from(schema.activationIncentivePolicies)
        .innerJoin(schema.models, eq(schema.models.id, schema.activationIncentivePolicies.modelId))
        .where(and(
          eq(schema.activationIncentivePolicies.dealerId, dealerId),
          lte(schema.activationIncentivePolicies.periodStart, periodEnd),
          gte(schema.activationIncentivePolicies.periodEnd, periodStart),
        )),
      db.select({
        id: schema.dealerIncentivePolicies.id,
        modelId: schema.dealerIncentivePolicies.modelId,
        modelName: schema.models.name,
        periodStart: schema.dealerIncentivePolicies.periodStart,
        periodEnd: schema.dealerIncentivePolicies.periodEnd,
        targetTotalActivations: schema.dealerIncentivePolicies.targetTotalActivations,
        perUnitAmount: schema.dealerIncentivePolicies.perUnitAmount,
      })
        .from(schema.dealerIncentivePolicies)
        .leftJoin(schema.models, eq(schema.models.id, schema.dealerIncentivePolicies.modelId))
        .where(and(
          eq(schema.dealerIncentivePolicies.dealerId, dealerId),
          lte(schema.dealerIncentivePolicies.periodStart, periodEnd),
          gte(schema.dealerIncentivePolicies.periodEnd, periodStart),
        )),
    ]);

  const entries: PolicyAchievementEntry[] = [];

  for (const p of targetBonusPolicies) {
    const actualQty = report.targetBonus.policyId === p.id ? report.targetBonus.actualQty : 0;
    const eligible = report.targetBonus.policyId === p.id ? report.targetBonus.eligible : false;
    const earned = eligible ? report.totals.bonusPercentEarned : 0;
    entries.push({ type: "target-bonus", modelName: null, periodStart: p.periodStart, periodEnd: p.periodEnd, targetQty: p.targetActivationsQty, perUnitAmount: p.bonusPercent, actualQty, earned, eligible });
  }

  for (const p of stockInPolicies) {
    const row = report.rows.find((r) => r.modelId === p.modelId);
    const actualQty = row?.effectiveStockInQty ?? 0;
    const eligible = p.minQty == null || actualQty >= p.minQty;
    const earned = row?.stockInEarned ?? 0;
    entries.push({ type: "stock-in", modelName: p.modelName, periodStart: p.periodStart, periodEnd: p.periodEnd, targetQty: p.minQty, perUnitAmount: p.perUnitAmount, actualQty, earned, eligible });
  }

  for (const p of activationIncentivePolicies) {
    const row = report.rows.find((r) => r.modelId === p.modelId);
    const actualQty = row?.qtyActivated ?? 0;
    const eligible = p.targetQty == null || actualQty >= p.targetQty;
    const earned = row?.activationIncentiveEarned ?? 0;
    entries.push({ type: "activation-incentive", modelName: p.modelName, periodStart: p.periodStart, periodEnd: p.periodEnd, targetQty: p.targetQty, perUnitAmount: p.perUnitAmount, actualQty, earned, eligible });
  }

  for (const p of dealerIncentivePolicies) {
    const actualQty = report.dealerIncentive.policyId === p.id ? report.dealerIncentive.actualTotal : 0;
    const eligible = report.dealerIncentive.policyId === p.id ? report.dealerIncentive.eligible : false;
    const earned = eligible ? report.totals.dealerIncentiveEarned : 0;
    entries.push({ type: "dealer-incentive", modelName: p.modelName ?? null, periodStart: p.periodStart, periodEnd: p.periodEnd, targetQty: p.targetTotalActivations, perUnitAmount: p.perUnitAmount, actualQty, earned, eligible });
  }

  return entries;
}

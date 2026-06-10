import "server-only";
import { db, schema } from "@/lib/db/client";
import { OWNER_TENANT_ID } from "@/lib/dealer";
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
        eq(schema.targetBonusPolicies.tenantId, OWNER_TENANT_ID),
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
          eq(schema.stockInPolicies.tenantId, OWNER_TENANT_ID),
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
          eq(schema.activationIncentivePolicies.tenantId, OWNER_TENANT_ID),
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
          eq(schema.dealerIncentivePolicies.tenantId, OWNER_TENANT_ID),
          eq(schema.dealerIncentivePolicies.dealerId, dealerId),
          lte(schema.dealerIncentivePolicies.periodStart, periodEnd),
          gte(schema.dealerIncentivePolicies.periodEnd, periodStart),
        )),
    ]);

  // Clamp policy date display to the report window — a multi-month policy should
  // only show the portion relevant to the selected period in PDFs/UI.
  const cs = (d: string) => d < periodStart ? periodStart : d;
  const ce = (d: string) => d > periodEnd ? periodEnd : d;

  const entries: PolicyAchievementEntry[] = [];

  for (const p of targetBonusPolicies) {
    const actualQty = report.targetBonus.policyId === p.id ? report.targetBonus.actualQty : 0;
    const eligible = report.targetBonus.policyId === p.id ? report.targetBonus.eligible : false;
    const earned = eligible ? report.totals.bonusPercentEarned : 0;
    entries.push({ type: "target-bonus", modelName: null, periodStart: cs(p.periodStart), periodEnd: ce(p.periodEnd), targetQty: p.targetActivationsQty, perUnitAmount: p.bonusPercent, actualQty, earned, eligible });
  }

  for (const p of stockInPolicies) {
    const row = report.rows.find((r) => r.modelId === p.modelId);
    const ledger = row?.stockInLedger?.find((l) => l.policyId === p.id);
    const eligibleQty = ledger?.eligibleQty ?? 0;
    const eligible = ledger?.met ?? false;
    const earned = ledger?.earned ?? 0;
    entries.push({ type: "stock-in", modelName: p.modelName, periodStart: cs(p.periodStart), periodEnd: ce(p.periodEnd), targetQty: p.minQty, perUnitAmount: p.perUnitAmount, actualQty: eligibleQty, eligibleQty, earned, eligible });
  }

  for (const p of activationIncentivePolicies) {
    const row = report.rows.find((r) => r.modelId === p.modelId);
    const ledger = row?.activationIncentiveLedger?.find((l) => l.policyId === p.id);
    const eligibleQty = ledger?.eligibleQty ?? 0;
    const eligible = ledger?.met ?? false;
    const earned = ledger?.earned ?? 0;
    entries.push({ type: "activation-incentive", modelName: p.modelName, periodStart: cs(p.periodStart), periodEnd: ce(p.periodEnd), targetQty: p.targetQty, perUnitAmount: p.perUnitAmount, actualQty: eligibleQty, eligibleQty, earned, eligible });
  }

  for (const p of dealerIncentivePolicies) {
    const outcome = report.dealerIncentives.find((d) => d.policyId === p.id);
    const actualQty = outcome?.actualTotal ?? 0;
    const eligible = outcome?.eligible ?? false;
    const earned = outcome?.earned ?? 0;
    entries.push({ type: "dealer-incentive", modelName: p.modelName ?? null, periodStart: cs(p.periodStart), periodEnd: ce(p.periodEnd), targetQty: p.targetTotalActivations, perUnitAmount: p.perUnitAmount, actualQty, earned, eligible });
  }

  return entries;
}

/**
 * Single source of truth for the Rs-0 Dealer Incentive rule: a dealer-incentive
 * policy whose rate resolves below Rs 1 is treated as zero and hidden from
 * statements/reports. Use everywhere a Dealer Incentive row renders — never fork.
 */
export const isZeroDealerIncentivePolicy = (
  p: Pick<PolicyAchievementEntry, "type" | "perUnitAmount">
): boolean => p.type === "dealer-incentive" && p.perUnitAmount < 1;

export interface DealerIncentiveModelPortion {
  modelId: string;
  modelName: string;
  qty: number;
  perUnit: number;
  amount: number;
}

export interface DealerIncentiveBreakdown {
  eligible: boolean;
  targetTotal: number;
  actualTotal: number;
  /** Uniform per-unit rate, or null when policies carry differing rates. */
  perUnit: number | null;
  totalEarned: number;
  models: DealerIncentiveModelPortion[];
}

/**
 * Dealer Incentive is secured on TOTAL activation qty, so it is ONE policy — but
 * the engine already attributes its payout per model (row.dealerIncentiveEarned).
 * This consolidates the single-policy outcome with that model-wise split for
 * display. The model portions sum EXACTLY to report.totals.dealerIncentiveEarned;
 * never recompute amounts downstream. Returns null when nothing was earned.
 * Use everywhere a Dealer Incentive breakdown renders — never fork.
 */
export function buildDealerIncentiveBreakdown(
  report: IncentiveReport
): DealerIncentiveBreakdown | null {
  const totalEarned = report.totals.dealerIncentiveEarned;
  if (totalEarned <= 0) return null;
  const outcomes = report.dealerIncentives ?? [];
  const rates = Array.from(new Set(outcomes.filter((d) => d.eligible).map((d) => d.perUnitAmount)));
  const perUnit = rates.length === 1 ? rates[0] : null;
  const primary = outcomes.find((d) => d.eligible) ?? outcomes[0];
  const models = report.rows
    .filter((r) => r.dealerIncentiveEarned > 0)
    .map((r) => {
      // Per-model effective rate = sum of eligible policy rates that apply to this
      // model: global policies (modelId null) + this model's own policy. Lets each
      // model show its true per-unit even when rates differ across models (where the
      // uniform `perUnit` above is null and would otherwise render "—").
      const modelRate = outcomes
        .filter((d) => d.eligible && (d.modelId === null || d.modelId === r.modelId))
        .reduce((s, d) => s + d.perUnitAmount, 0);
      return {
        modelId: r.modelId,
        modelName: r.modelName,
        amount: r.dealerIncentiveEarned,
        perUnit: modelRate,
        qty: modelRate > 0 ? Math.round(r.dealerIncentiveEarned / modelRate) : r.qtyActivated,
      };
    })
    .sort((a, b) => b.amount - a.amount);
  return {
    eligible: outcomes.some((d) => d.eligible),
    targetTotal: primary?.targetTotal ?? 0,
    actualTotal: primary?.actualTotal ?? 0,
    perUnit,
    totalEarned,
    models,
  };
}

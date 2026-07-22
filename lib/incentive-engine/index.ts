import type {
  EngineActivation,
  EngineDealerIncentivePolicy,
  EngineInput,
  EngineTargetBonusPolicy,
  IncentiveReport,
  IncentiveReportRow,
  PriceSubperiod,
  StockInPolicyLedger,
  CombinedStockInLedger,
  TargetBonusOutcome,
  ISODate,
} from "./types";
import { inRange, round2, buildActivationIncentiveLedger } from "./shared";
import { computeCrCaughtLoss } from "./cr-loss";

export type * from "./types";

/**
 * Find the most-recent target-bonus policy whose window covers the report period.
 * Spec: "applies retroactively to all phones activated in [period_start, period_end]
 *        IF total activations in that window >= target".
 *
 * We pick the policy whose window FULLY covers the requested report period; if
 * none, we pick the policy with the largest overlap (used for partial-window
 * audits). This is conservative and predictable.
 */
function pickTargetBonusPolicy(
  policies: EngineTargetBonusPolicy[],
  periodStart: ISODate,
  periodEnd: ISODate
): EngineTargetBonusPolicy | null {
  if (policies.length === 0) return null;
  const covering = policies.filter(
    (p) => p.periodStart <= periodStart && p.periodEnd >= periodEnd
  );
  if (covering.length > 0) {
    // most-recent start wins on ties
    return covering.sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1))[0];
  }
  // overlapping but not fully covering
  const overlapping = policies.filter(
    (p) => p.periodStart <= periodEnd && p.periodEnd >= periodStart
  );
  if (overlapping.length === 0) return null;
  return overlapping.sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1))[0];
}


/**
 * Pure calculator. Takes data, returns a structured incentive report.
 *
 * Algorithm:
 *  1. Filter activations into the report period; split cross-region tag.
 *  2. Determine target-bonus eligibility (1%) using activations in the bonus policy's window.
 *  3. Determine dealer-incentive eligibility using activations in that policy's window.
 *  4. For each activation in window: compute 4%, 1% (if eligible), activation incentive, dealer incentive.
 *  5. For each model: roll up purchases (REGULAR-only for stock-in earnings; cross-region tracked separately).
 *  6. Apply stock-in policies on REGULAR purchases (respecting min_qty).
 *  7. Build per-model rows with price-sub-period breakdowns; sum totals.
 */
export function calculateIncentives(input: EngineInput): IncentiveReport {
  const {
    dealerId,
    periodStart,
    periodEnd,
    baseIncentivePercent,
    models,
    activations,
    purchases,
    targetBonusPolicies,
    stockInPolicies,
    activationIncentivePolicies,
    dealerIncentivePolicies,
    combinedStockInPolicies = [],
    interIdOut = [],
    crCaught = [],
  } = input;

  if (periodEnd < periodStart) {
    throw new Error("periodEnd must be on/after periodStart");
  }
  if (baseIncentivePercent < 0 || baseIncentivePercent > 100) {
    throw new Error("baseIncentivePercent must be in [0, 100]");
  }

  // ----- Target Bonus eligibility -----
  // Gate: total REGULAR purchases in the policy window must reach targetActivationsQty.
  // Reward: bonusPercent applied to every activation in the report period.
  const tbp = pickTargetBonusPolicy(targetBonusPolicies, periodStart, periodEnd);
  const tbpPurchaseQty = tbp
    ? purchases
        .filter((p) => p.source === "REGULAR" && inRange(p.purchaseDate, tbp.periodStart, tbp.periodEnd))
        .reduce((sum, p) => sum + p.quantity, 0)
    : 0;
  const tbpEligible = !!tbp && tbpPurchaseQty >= tbp.targetActivationsQty;

  // ----- Target Bonus cap (#6) -----
  // Once the purchase gate is met, the bonus is paid on at most `bonusCapQty` phones,
  // taken chronologically across the POLICY window. Counting over the report window
  // instead would grant a fresh N every month of a longer policy, defeating the cap.
  // Ties on activationDate are broken by id so the chosen set is deterministic.
  const policyWindowActs = tbp
    ? activations
        .filter((a) => inRange(a.activationDate, tbp.periodStart, tbp.periodEnd))
        .sort((a, b) =>
          a.activationDate === b.activationDate
            ? a.id.localeCompare(b.id)
            : a.activationDate < b.activationDate ? -1 : 1
        )
    : [];
  const bonusCapQty = tbp?.bonusCapQty ?? null;
  const bonusEligibleActs =
    bonusCapQty == null ? policyWindowActs : policyWindowActs.slice(0, bonusCapQty);
  const bonusEligibleIds = new Set(bonusEligibleActs.map((a) => a.id));

  const targetBonus: TargetBonusOutcome = {
    policyId: tbp?.id ?? null,
    eligible: tbpEligible,
    targetQty: tbp?.targetActivationsQty ?? null,
    actualQty: tbpPurchaseQty,
    bonusPercent: tbp?.bonusPercent ?? 0,
    bonusCapQty,
    bonusEligibleQty: tbpEligible ? bonusEligibleActs.length : 0,
    policyWindowActivations: policyWindowActs.length,
  };

  // ----- Dealer Incentive: all policies run simultaneously -----
  // targetTotalActivations is a global threshold (all activations count toward it).
  // modelId, when set, restricts which activations EARN the per-unit amount.
  type DipStatus = {
    policy: EngineDealerIncentivePolicy;
    eligible: boolean;
    actualTotal: number;
    earned: number;
  };
  const dipStatuses: DipStatus[] = dealerIncentivePolicies
    .filter((p) => p.periodStart <= periodEnd && p.periodEnd >= periodStart)
    .map((p) => {
      const actualTotal = activations.filter((a) => inRange(a.activationDate, p.periodStart, p.periodEnd)).length;
      return { policy: p, eligible: actualTotal >= p.targetTotalActivations, actualTotal, earned: 0 };
    });

  // ----- Filter activations to report window -----
  const reportActivations = activations.filter((a) =>
    inRange(a.activationDate, periodStart, periodEnd)
  );

  // ----- Group by model -----
  const modelMap = new Map(models.map((m) => [m.id, m]));
  type ModelBucket = {
    activations: EngineActivation[];
    regularQty: number;
    crossRegionQty: number;
    interIdOutQty: number;
  };
  const byModel = new Map<string, ModelBucket>();
  const blank = (): ModelBucket => ({
    activations: [],
    regularQty: 0,
    crossRegionQty: 0,
    interIdOutQty: 0,
  });

  for (const m of models) byModel.set(m.id, blank());

  for (const act of reportActivations) {
    if (!byModel.has(act.modelId)) byModel.set(act.modelId, blank());
    byModel.get(act.modelId)!.activations.push(act);
  }

  // ----- Purchases in report window -----
  let totalRegular = 0;
  let totalCross = 0;
  for (const p of purchases) {
    if (!inRange(p.purchaseDate, periodStart, periodEnd)) continue;
    if (!byModel.has(p.modelId)) byModel.set(p.modelId, blank());
    const bucket = byModel.get(p.modelId)!;
    if (p.source === "REGULAR") {
      bucket.regularQty += p.quantity;
      totalRegular += p.quantity;
    } else if (p.source === "CROSS_REGION_TRANSFER_IN") {
      bucket.crossRegionQty += p.quantity;
      totalCross += p.quantity;
    }
    // INTER_ID_TRANSFER_IN is real stock but neither a company purchase nor a
    // cross-region-in — excluded from both display totals (and, via the REGULAR
    // filters below, from stock-in earning + the target-bonus gate).
  }

  // ----- Inter-ID outbound transfers in report window -----
  for (const t of interIdOut) {
    if (!inRange(t.transferDate, periodStart, periodEnd)) continue;
    if (!byModel.has(t.modelId)) byModel.set(t.modelId, blank());
    byModel.get(t.modelId)!.interIdOutQty += t.quantity;
  }

  // ----- Combined stock-in policies (grouped target, per-model rate) -----
  // Evaluated as a SEPARATE, additive pass so per-model stock-in is untouched.
  // Target is counted across the group's models; once met, each model is paid on
  // its FULL eligible qty (regular purchases − inter-ID out, in the policy window)
  // at its own rate. Earnings are folded into each model's stockInEarned below.
  const combinedEarnedByModel = new Map<string, number>();
  const combinedStockInLedger: CombinedStockInLedger[] = [];
  for (const cp of combinedStockInPolicies) {
    if (!(cp.periodStart <= periodEnd && cp.periodEnd >= periodStart)) continue;
    const perModelElig = cp.models.map((cm) => {
      const regularQty = purchases
        .filter((p) => p.modelId === cm.modelId && p.source === "REGULAR" && inRange(p.purchaseDate, cp.periodStart, cp.periodEnd))
        .reduce((s, p) => s + p.quantity, 0);
      // Owner rule: stock-in is never reversed by an outbound transfer — the
      // purchaser keeps it. So eligible qty = REGULAR (direct company) purchases only.
      return { modelId: cm.modelId, perUnitAmount: cm.perUnitAmount, eligibleQty: regularQty };
    });
    const combinedEligibleQty = perModelElig.reduce((s, m) => s + m.eligibleQty, 0);
    const met = combinedEligibleQty >= cp.targetQty && combinedEligibleQty > 0;
    let totalEarned = 0;
    const perModel = perModelElig.map((m) => {
      const earned = met ? round2(m.eligibleQty * m.perUnitAmount) : 0;
      totalEarned += earned;
      if (earned > 0) combinedEarnedByModel.set(m.modelId, round2((combinedEarnedByModel.get(m.modelId) ?? 0) + earned));
      return {
        modelId: m.modelId,
        modelName: modelMap.get(m.modelId)?.name ?? `(unknown ${m.modelId})`,
        eligibleQty: m.eligibleQty,
        perUnitAmount: m.perUnitAmount,
        earned,
      };
    });
    combinedStockInLedger.push({
      policyId: cp.id,
      periodStart: cp.periodStart,
      periodEnd: cp.periodEnd,
      targetQty: cp.targetQty,
      combinedEligibleQty,
      met,
      perModel,
      totalEarned: round2(totalEarned),
    });
  }
  // A model that only earns via a combined policy (no report-window activity)
  // still needs a row so its earnings aren't dropped.
  for (const modelId of combinedEarnedByModel.keys()) {
    if (!byModel.has(modelId)) byModel.set(modelId, blank());
  }

  const basePct = baseIncentivePercent / 100;
  const bonusPct = tbpEligible ? (tbp!.bonusPercent / 100) : 0;

  // ----- Build per-model rows -----
  const rows: IncentiveReportRow[] = [];
  let totalsBase = 0;
  let totalsBonus = 0;
  let totalsActivation = 0;
  let totalsDealer = 0;
  let totalsStockIn = 0;

  for (const [modelId, bucket] of byModel.entries()) {
    const model = modelMap.get(modelId);
    const modelName = model?.name ?? `(unknown ${modelId})`;

    if (
      bucket.activations.length === 0 &&
      bucket.regularQty === 0 &&
      bucket.crossRegionQty === 0 &&
      (combinedEarnedByModel.get(modelId) ?? 0) === 0
    ) {
      // Nothing happened for this model in window — skip.
      continue;
    }

    // Sub-period breakdown by snapshot price
    const subMap = new Map<number, number>(); // dealerPrice -> qty
    // Bonus-earning qty is tracked separately: under a cap, only some of a price
    // band's phones earn the 1%, so it cannot be derived from `subMap` alone.
    const bonusSubMap = new Map<number, number>(); // dealerPrice -> bonus-earning qty
    let qtyTotal = 0;
    let qtyCross = 0;
    let baseEarned = 0;
    let bonusEarned = 0;
    let dealerIncEarned = 0;

    for (const act of bucket.activations) {
      qtyTotal += 1;
      if (act.isCrossRegion) qtyCross += 1;

      const price = act.dealerPriceSnapshot;
      subMap.set(price, (subMap.get(price) ?? 0) + 1);

      baseEarned += price * basePct;
      if (tbpEligible && bonusEligibleIds.has(act.id)) {
        bonusEarned += price * bonusPct;
        bonusSubMap.set(price, (bonusSubMap.get(price) ?? 0) + 1);
      }

      for (const ds of dipStatuses) {
        if (!ds.eligible) continue;
        if (!inRange(act.activationDate, ds.policy.periodStart, ds.policy.periodEnd)) continue;
        if (ds.policy.modelId && act.modelId !== ds.policy.modelId) continue;
        dealerIncEarned += ds.policy.perUnitAmount;
        ds.earned += ds.policy.perUnitAmount;
      }
    }

    // Activation incentive: accumulator pattern — each policy evaluated independently.
    const activationIncentiveLedger = buildActivationIncentiveLedger(
      activationIncentivePolicies,
      modelId,
      periodStart,
      periodEnd,
      bucket.activations,
      activations,
    );
    const activationEarned = activationIncentiveLedger.reduce((s, l) => s + l.earned, 0);

    // Stock-in: each overlapping policy is evaluated independently in its own date window.
    // Earned amounts are accumulated (+=) so multiple policies for the same model are all paid.
    const overlappingSips = stockInPolicies.filter(
      (p) =>
        p.modelId === modelId &&
        p.periodStart <= periodEnd &&
        p.periodEnd >= periodStart
    );
    const stockInLedger: StockInPolicyLedger[] = [];
    let totalSipRegularQty = 0;
    let totalSipInterIdOutQty = 0;
    let stockInEarned = 0;
    for (const sip of overlappingSips) {
      const sipRegularQty = purchases
        .filter(
          (p) =>
            p.modelId === modelId &&
            p.source === "REGULAR" &&
            inRange(p.purchaseDate, sip.periodStart, sip.periodEnd)
        )
        .reduce((sum, p) => sum + p.quantity, 0);
      const sipInterIdOutQty = interIdOut
        .filter(
          (t) =>
            t.modelId === modelId &&
            inRange(t.transferDate, sip.periodStart, sip.periodEnd)
        )
        .reduce((sum, t) => sum + t.quantity, 0);
      // Owner rule: outbound transfers never reverse stock-in — the purchaser keeps
      // it. Eligible qty = REGULAR (direct company) purchases only. sipInterIdOutQty
      // is retained for the informational interIdOutQty row field, not for earning.
      const eligibleQty = sipRegularQty;
      const minQty = sip.minQty ?? 0;
      const met = eligibleQty >= minQty && eligibleQty > 0;
      const policyEarned = met ? round2(eligibleQty * sip.perUnitAmount) : 0;
      stockInLedger.push({
        policyId: sip.id,
        periodStart: sip.periodStart,
        periodEnd: sip.periodEnd,
        perUnitAmount: sip.perUnitAmount,
        minQty: sip.minQty,
        eligibleQty,
        earned: policyEarned,
        met,
      });
      totalSipRegularQty += sipRegularQty;
      totalSipInterIdOutQty += sipInterIdOutQty;
      stockInEarned += policyEarned;
    }
    // Fold in any grouped (combined) stock-in earnings for this model.
    stockInEarned += combinedEarnedByModel.get(modelId) ?? 0;

    const effectiveStockInQty = totalSipRegularQty;

    const priceSubperiods: PriceSubperiod[] = [...subMap.entries()]
      .map(([dealerPrice, qty]) => ({
        dealerPrice,
        qty,
        basePercentSubtotal: round2(dealerPrice * basePct * qty),
        bonusPercentSubtotal: round2(dealerPrice * bonusPct * (bonusSubMap.get(dealerPrice) ?? 0)),
      }))
      .sort((a, b) => a.dealerPrice - b.dealerPrice);

    const total = baseEarned + bonusEarned + activationEarned + dealerIncEarned + stockInEarned;

    rows.push({
      modelId,
      modelName,
      qtyActivated: qtyTotal,
      qtyActivatedCrossRegion: qtyCross,
      priceSubperiods,
      basePercentEarned: round2(baseEarned),
      bonusPercentEarned: round2(bonusEarned),
      activationIncentiveEarned: round2(activationEarned),
      dealerIncentiveEarned: round2(dealerIncEarned),
      stockInRegularQty: totalSipRegularQty,
      stockInCrossRegionQty: bucket.crossRegionQty,
      interIdOutQty: totalSipInterIdOutQty,
      effectiveStockInQty,
      stockInEarned: round2(stockInEarned),
      stockInLedger,
      activationIncentiveLedger,
      total: round2(total),
    });

    totalsBase += baseEarned;
    totalsBonus += bonusEarned;
    totalsActivation += activationEarned;
    totalsDealer += dealerIncEarned;
    totalsStockIn += stockInEarned;
  }

  rows.sort((a, b) => b.total - a.total);

  const grandTotal = totalsBase + totalsBonus + totalsActivation + totalsDealer + totalsStockIn;

  const totalActivations = reportActivations.length;
  const totalActivationsCross = reportActivations.filter((a) => a.isCrossRegion).length;

  // Estimated incentive lost to CR-caught units. Computed last, so it reads the gate
  // outcomes this report already resolved rather than deriving its own.
  const potentialLoss = computeCrCaughtLoss({
    crCaught: crCaught.filter((c) => inRange(c.caughtDate, periodStart, periodEnd)),
    baseIncentivePercent,
    targetBonus,
    dealerIncentives: dipStatuses.map((ds) => ({ policy: ds.policy, eligible: ds.eligible })),
    activationIncentivePolicies,
    activations,
    bonusSlotsRemaining:
      bonusCapQty == null ? null : Math.max(0, bonusCapQty - bonusEligibleActs.length),
  });

  return {
    dealerId,
    periodStart,
    periodEnd,
    baseIncentivePercent,
    totalActivations,
    totalActivationsCrossRegion: totalActivationsCross,
    totalRegularPurchaseQty: totalRegular,
    totalCrossRegionPurchaseQty: totalCross,
    targetBonus,
    dealerIncentives: dipStatuses.map((ds) => ({
      policyId: ds.policy.id,
      modelId: ds.policy.modelId ?? null,
      eligible: ds.eligible,
      targetTotal: ds.policy.targetTotalActivations,
      actualTotal: ds.actualTotal,
      perUnitAmount: ds.policy.perUnitAmount,
      earned: round2(ds.earned),
    })),
    combinedStockInLedger,
    potentialLoss,
    rows,
    totals: {
      basePercentEarned: round2(totalsBase),
      bonusPercentEarned: round2(totalsBonus),
      activationIncentiveEarned: round2(totalsActivation),
      dealerIncentiveEarned: round2(totalsDealer),
      stockInEarned: round2(totalsStockIn),
      grandTotal: round2(grandTotal),
    },
  };
}

import type {
  EngineActivation,
  EngineActivationIncentivePolicy,
  EngineDealerIncentivePolicy,
  EngineInput,
  EngineStockInPolicy,
  EngineTargetBonusPolicy,
  IncentiveReport,
  IncentiveReportRow,
  PriceSubperiod,
  TargetBonusOutcome,
  ISODate,
} from "./types";

export type * from "./types";

/** Inclusive ISO-date interval check. ISO `YYYY-MM-DD` sorts lexically. */
const inRange = (d: ISODate, start: ISODate, end: ISODate): boolean =>
  d >= start && d <= end;

/** Round to 2 decimals (PKR is whole-rupee in practice; this avoids float fuzz). */
const round2 = (n: number): number => Math.round(n * 100) / 100;

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


function findActivationIncentive(
  policies: EngineActivationIncentivePolicy[],
  modelId: string,
  activationDate: ISODate,
  allActivationsForDealer: EngineActivation[]
): {
  policy: EngineActivationIncentivePolicy;
  fires: boolean;
  perUnit: number;
} | null {
  const candidates = policies.filter(
    (p) => p.modelId === modelId && inRange(activationDate, p.periodStart, p.periodEnd)
  );
  if (candidates.length === 0) return null;
  // pick the most-specific (latest start) policy
  const policy = candidates.sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1))[0];
  if (policy.targetQty == null) {
    return { policy, fires: true, perUnit: policy.perUnitAmount };
  }
  // Count activations of this model inside the policy's window for this dealer
  const qty = allActivationsForDealer.filter(
    (a) => a.modelId === modelId && inRange(a.activationDate, policy.periodStart, policy.periodEnd)
  ).length;
  const fires = qty >= policy.targetQty;
  return { policy, fires, perUnit: fires ? policy.perUnitAmount : 0 };
}

function applicableStockInPolicy(
  policies: EngineStockInPolicy[],
  modelId: string,
  periodStart: ISODate,
  periodEnd: ISODate
): EngineStockInPolicy | null {
  // Pick the policy with the largest overlap (or any covering policy) for this model in the window.
  const overlapping = policies.filter(
    (p) =>
      p.modelId === modelId &&
      p.periodStart <= periodEnd &&
      p.periodEnd >= periodStart
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
    interIdOut = [],
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
  const targetBonus: TargetBonusOutcome = {
    policyId: tbp?.id ?? null,
    eligible: tbpEligible,
    targetQty: tbp?.targetActivationsQty ?? null,
    actualQty: tbpPurchaseQty,
    bonusPercent: tbp?.bonusPercent ?? 0,
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
    } else {
      bucket.crossRegionQty += p.quantity;
      totalCross += p.quantity;
    }
  }

  // ----- Inter-ID outbound transfers in report window -----
  for (const t of interIdOut) {
    if (!inRange(t.transferDate, periodStart, periodEnd)) continue;
    if (!byModel.has(t.modelId)) byModel.set(t.modelId, blank());
    byModel.get(t.modelId)!.interIdOutQty += t.quantity;
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
      bucket.crossRegionQty === 0
    ) {
      // Nothing happened for this model in window — skip.
      continue;
    }

    // Sub-period breakdown by snapshot price
    const subMap = new Map<number, number>(); // dealerPrice -> qty
    let qtyTotal = 0;
    let qtyCross = 0;
    let baseEarned = 0;
    let bonusEarned = 0;
    let activationEarned = 0;
    let dealerIncEarned = 0;

    for (const act of bucket.activations) {
      qtyTotal += 1;
      if (act.isCrossRegion) qtyCross += 1;

      const price = act.dealerPriceSnapshot;
      subMap.set(price, (subMap.get(price) ?? 0) + 1);

      const four = price * basePct;
      baseEarned += four;

      if (tbpEligible) {
        bonusEarned += price * bonusPct;
      }

      const aip = findActivationIncentive(
        activationIncentivePolicies,
        modelId,
        act.activationDate,
        activations
      );
      if (aip && aip.fires) {
        activationEarned += aip.perUnit;
      }

      for (const ds of dipStatuses) {
        if (!ds.eligible) continue;
        if (!inRange(act.activationDate, ds.policy.periodStart, ds.policy.periodEnd)) continue;
        if (ds.policy.modelId && act.modelId !== ds.policy.modelId) continue;
        dealerIncEarned += ds.policy.perUnitAmount;
        ds.earned += ds.policy.perUnitAmount;
      }
    }

    // Stock-in: only REGULAR purchases whose purchaseDate falls inside the policy's own
    // date window (sip.periodStart … sip.periodEnd) count. Purchases outside that window
    // do not earn stock-in even if they are within the report period.
    const sip = applicableStockInPolicy(stockInPolicies, modelId, periodStart, periodEnd);
    let sipRegularQty = 0;
    let sipInterIdOutQty = 0;
    if (sip) {
      sipRegularQty = purchases
        .filter(
          (p) =>
            p.modelId === modelId &&
            p.source === "REGULAR" &&
            inRange(p.purchaseDate, sip.periodStart, sip.periodEnd)
        )
        .reduce((sum, p) => sum + p.quantity, 0);
      sipInterIdOutQty = interIdOut
        .filter(
          (t) =>
            t.modelId === modelId &&
            inRange(t.transferDate, sip.periodStart, sip.periodEnd)
        )
        .reduce((sum, t) => sum + t.quantity, 0);
    }
    const effectiveStockInQty = Math.max(0, sipRegularQty - sipInterIdOutQty);
    let stockInEarned = 0;
    if (sip) {
      const minQty = sip.minQty ?? 0;
      if (effectiveStockInQty >= minQty && effectiveStockInQty > 0) {
        stockInEarned = effectiveStockInQty * sip.perUnitAmount;
      }
    }

    const priceSubperiods: PriceSubperiod[] = [...subMap.entries()]
      .map(([dealerPrice, qty]) => ({
        dealerPrice,
        qty,
        basePercentSubtotal: round2(dealerPrice * basePct * qty),
        bonusPercentSubtotal: round2(dealerPrice * bonusPct * qty),
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
      stockInRegularQty: sipRegularQty,
      stockInCrossRegionQty: bucket.crossRegionQty,
      interIdOutQty: sipInterIdOutQty,
      effectiveStockInQty,
      stockInEarned: round2(stockInEarned),
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

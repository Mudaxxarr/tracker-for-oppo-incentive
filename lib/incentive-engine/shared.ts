import type {
  ActivationIncentivePolicyLedger,
  EngineActivation,
  EngineActivationIncentivePolicy,
  ISODate,
} from "./types";

/** Inclusive ISO-date interval check. ISO `YYYY-MM-DD` sorts lexically. */
export const inRange = (d: ISODate, start: ISODate, end: ISODate): boolean =>
  d >= start && d <= end;

/** Round to 2 decimals (PKR is whole-rupee in practice; this avoids float fuzz). */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Resolves which base incentive % a report should use (#4).
 *
 * Precedence: an explicit caller value → the dealer ID's own rate → the global constant.
 * Retail IDs typically sit on the global 4; wholesale IDs carry a 3 override.
 *
 * Uses null checks rather than truthiness on purpose: a deliberate 0% override must
 * stay 0, and `override || global` would quietly pay the global rate instead.
 */
export function resolveBaseIncentivePercent(
  explicit: number | null | undefined,
  idOverride: number | null | undefined,
  globalPercent: number,
): number {
  if (explicit != null) return explicit;
  if (idOverride != null) return idOverride;
  return globalPercent;
}

/**
 * The activation-incentive gate, in one place.
 *
 * Threshold counts ALL dealer activations of this model inside the policy's own
 * window — which may extend outside the report window. A null targetQty means
 * "any activity qualifies".
 *
 * Both the earnings ledger and the CR-caught loss calculation call this, so the
 * gate can never drift between what a dealer earns and what they are told they lost.
 */
export function isActivationIncentiveGateMet(
  p: EngineActivationIncentivePolicy,
  modelId: string,
  allActivations: EngineActivation[],
): boolean {
  const thresholdQty = allActivations.filter(
    (a) => a.modelId === modelId && inRange(a.activationDate, p.periodStart, p.periodEnd)
  ).length;
  return p.targetQty == null ? thresholdQty > 0 : thresholdQty >= p.targetQty;
}

/**
 * Builds a per-policy activation-incentive ledger for one model.
 * Each overlapping policy is evaluated independently — their earned amounts accumulate (+=).
 * Threshold check uses ALL dealer activations in the policy window (not just the report slice).
 * Earning qty is the intersection of the policy window and the report window.
 */
export function buildActivationIncentiveLedger(
  policies: EngineActivationIncentivePolicy[],
  modelId: string,
  periodStart: ISODate,
  periodEnd: ISODate,
  reportWindowActivations: EngineActivation[], // already filtered to report window
  allActivations: EngineActivation[],           // full input, for threshold gate
): ActivationIncentivePolicyLedger[] {
  const overlapping = policies.filter(
    (p) => p.modelId === modelId && p.periodStart <= periodEnd && p.periodEnd >= periodStart
  );
  return overlapping.map((p) => {
    const met = isActivationIncentiveGateMet(p, modelId, allActivations);
    // Earning: activations in the intersection of policy window and report window
    const eligibleQty = reportWindowActivations.filter(
      (a) => inRange(a.activationDate, p.periodStart, p.periodEnd)
    ).length;
    return {
      policyId: p.id,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      perUnitAmount: p.perUnitAmount,
      targetQty: p.targetQty,
      eligibleQty,
      earned: met ? round2(eligibleQty * p.perUnitAmount) : 0,
      met,
    };
  });
}

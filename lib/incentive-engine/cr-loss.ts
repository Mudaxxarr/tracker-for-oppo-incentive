import { inRange, round2, isActivationIncentiveGateMet } from "./shared";
import type {
  CrCaughtPotentialLoss,
  CrLossComponent,
  EngineActivation,
  EngineActivationIncentivePolicy,
  EngineCrCaught,
  EngineDealerIncentivePolicy,
  TargetBonusOutcome,
} from "./types";

export interface CrLossInput {
  crCaught: EngineCrCaught[];
  baseIncentivePercent: number;
  /** Already-resolved outcome from the report — the gate is not re-derived here. */
  targetBonus: TargetBonusOutcome;
  /** Already-resolved dealer-incentive outcomes, paired with their policies for window/model checks. */
  dealerIncentives: { policy: EngineDealerIncentivePolicy; eligible: boolean }[];
  activationIncentivePolicies: EngineActivationIncentivePolicy[];
  /** All activations the engine loaded — used only for the activation-incentive gate. */
  activations: EngineActivation[];
}

const EMPTY: CrCaughtPotentialLoss = {
  totalUnits: 0,
  basePercentLost: 0,
  bonusPercentLost: 0,
  activationIncentiveLost: 0,
  dealerIncentiveLost: 0,
  total: 0,
  components: [],
};

/**
 * Estimates the incentive that CR-caught units would have earned had they stayed.
 *
 * Method (owner-confirmed): a sum of per-unit rates, using the policies active on each
 * unit's `caughtDate`. A component is counted only when that policy's gate was actually
 * met — money the dealer was never going to earn was not lost. The base % has no gate.
 *
 * Deliberately NOT modelled:
 *  - Stock-in. It belongs to whoever purchased from the company and never reverses.
 *  - The marginal/threshold effect (units that caused a gate to be missed). That is a
 *    counterfactual and would reintroduce the guesswork this function exists to remove.
 *
 * TODO(finding #6): once `target_bonus_policies.bonus_cap_qty` lands, the bonus component
 * must become cap-aware. Today every caught unit in a qualified period is credited the full
 * bonus %, but under a cap only the first N activated units earn it, so some caught units
 * would have fallen outside the cap and lost nothing.
 */
export function computeCrCaughtLoss(input: CrLossInput): CrCaughtPotentialLoss {
  const {
    crCaught,
    baseIncentivePercent,
    targetBonus,
    dealerIncentives,
    activationIncentivePolicies,
    activations,
  } = input;

  if (crCaught.length === 0) return { ...EMPTY, components: [] };

  const components: CrLossComponent[] = [];
  let totalUnits = 0;
  let baseLost = 0;
  let bonusLost = 0;
  let activationLost = 0;
  let dealerLost = 0;

  for (const r of crCaught) {
    totalUnits += r.quantity;
    const value = r.quantity * r.dealerPriceSnapshot;

    // --- Base %: no gate, always lost ---
    const baseAmount = round2(value * (baseIncentivePercent / 100));
    baseLost += baseAmount;
    components.push({ kind: "base", policyId: null, gateMet: true, amount: baseAmount });

    // --- Target bonus (the 1%): gated on the report's resolved eligibility ---
    const bonusAmount = targetBonus.eligible
      ? round2(value * (targetBonus.bonusPercent / 100))
      : 0;
    bonusLost += bonusAmount;
    components.push({
      kind: "bonus",
      policyId: targetBonus.policyId,
      gateMet: targetBonus.eligible,
      amount: bonusAmount,
    });

    // --- Activation incentive: per-policy, model-scoped, window must contain caughtDate ---
    for (const p of activationIncentivePolicies) {
      if (p.modelId !== r.modelId) continue;
      if (!inRange(r.caughtDate, p.periodStart, p.periodEnd)) continue;
      const gateMet = isActivationIncentiveGateMet(p, r.modelId, activations);
      const amount = gateMet ? round2(r.quantity * p.perUnitAmount) : 0;
      activationLost += amount;
      components.push({ kind: "activationIncentive", policyId: p.id, gateMet, amount });
    }

    // --- Dealer incentive: null modelId means all models ---
    for (const { policy, eligible } of dealerIncentives) {
      if (policy.modelId && policy.modelId !== r.modelId) continue;
      if (!inRange(r.caughtDate, policy.periodStart, policy.periodEnd)) continue;
      const amount = eligible ? round2(r.quantity * policy.perUnitAmount) : 0;
      dealerLost += amount;
      components.push({
        kind: "dealerIncentive",
        policyId: policy.id,
        gateMet: eligible,
        amount,
      });
    }
  }

  return {
    totalUnits,
    basePercentLost: round2(baseLost),
    bonusPercentLost: round2(bonusLost),
    activationIncentiveLost: round2(activationLost),
    dealerIncentiveLost: round2(dealerLost),
    total: round2(baseLost + bonusLost + activationLost + dealerLost),
    components,
  };
}

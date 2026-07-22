import { describe, expect, it } from "vitest";
import { computeCrCaughtLoss } from "@/lib/incentive-engine/cr-loss";
import type {
  EngineActivation,
  EngineActivationIncentivePolicy,
  EngineCrCaught,
  EngineDealerIncentivePolicy,
  TargetBonusOutcome,
} from "@/lib/incentive-engine/types";

const MODEL_A = "model-a";
const MODEL_B = "model-b";

const caught = (over: Partial<EngineCrCaught> = {}): EngineCrCaught => ({
  id: "cr1",
  modelId: MODEL_A,
  quantity: 5,
  caughtDate: "2026-05-10",
  dealerPriceSnapshot: 40_000,
  ...over,
});

const bonusMet: TargetBonusOutcome = {
  policyId: "tbp1", eligible: true, targetQty: 10, actualQty: 20, bonusPercent: 1,
};
const bonusMissed: TargetBonusOutcome = { ...bonusMet, eligible: false };

const aipMet: EngineActivationIncentivePolicy = {
  id: "aip1", modelId: MODEL_A, periodStart: "2026-05-01", periodEnd: "2026-05-31",
  perUnitAmount: 500, targetQty: 2,
};
const dipPolicy: EngineDealerIncentivePolicy = {
  id: "dip1", modelId: null, periodStart: "2026-05-01", periodEnd: "2026-05-31",
  targetTotalActivations: 3, perUnitAmount: 300,
};

/** Three MODEL_A activations in May — enough to meet aipMet (target 2). */
const activations: EngineActivation[] = [1, 2, 3].map((n) => ({
  id: `a${n}`, modelId: MODEL_A, activationDate: "2026-05-0" + n,
  dealerPriceSnapshot: 40_000, isCrossRegion: false,
}));

const base = (over: Partial<Parameters<typeof computeCrCaughtLoss>[0]> = {}) =>
  computeCrCaughtLoss({
    crCaught: [caught()],
    baseIncentivePercent: 4,
    targetBonus: bonusMet,
    dealerIncentives: [{ policy: dipPolicy, eligible: true }],
    activationIncentivePolicies: [aipMet],
    activations,
    ...over,
  });

describe("cr-loss: all gates met", () => {
  it("sums base, bonus, activation incentive and dealer incentive", () => {
    const r = base();
    // 5 units @ 40,000
    expect(r.totalUnits).toBe(5);
    expect(r.basePercentLost).toBe(8_000);          // 5 * 40000 * 0.04
    expect(r.bonusPercentLost).toBe(2_000);         // 5 * 40000 * 0.01
    expect(r.activationIncentiveLost).toBe(2_500);  // 5 * 500
    expect(r.dealerIncentiveLost).toBe(1_500);      // 5 * 300
    expect(r.total).toBe(14_000);
  });
});

describe("cr-loss: gating", () => {
  it("zeroes the dealer incentive when its gate was missed, leaving the rest intact", () => {
    const r = base({ dealerIncentives: [{ policy: dipPolicy, eligible: false }] });
    expect(r.dealerIncentiveLost).toBe(0);
    expect(r.basePercentLost).toBe(8_000);
    expect(r.bonusPercentLost).toBe(2_000);
    expect(r.total).toBe(12_500);
    expect(r.components).toContainEqual({
      kind: "dealerIncentive", policyId: "dip1", gateMet: false, amount: 0,
    });
  });

  it("zeroes the bonus when the target-bonus gate was missed", () => {
    const r = base({ targetBonus: bonusMissed });
    expect(r.bonusPercentLost).toBe(0);
    expect(r.total).toBe(12_000);
  });

  it("zeroes the activation incentive when too few activations met its target", () => {
    // targetQty 99 cannot be met by 3 activations
    const r = base({ activationIncentivePolicies: [{ ...aipMet, targetQty: 99 }] });
    expect(r.activationIncentiveLost).toBe(0);
    expect(r.total).toBe(11_500);
  });

  it("always counts the base % — it has no gate", () => {
    const r = base({
      targetBonus: bonusMissed,
      dealerIncentives: [{ policy: dipPolicy, eligible: false }],
      activationIncentivePolicies: [],
    });
    expect(r.basePercentLost).toBe(8_000);
    expect(r.total).toBe(8_000);
  });
});

describe("cr-loss: policy windows and model scoping", () => {
  it("ignores a policy whose window does not contain the caught date", () => {
    const r = base({
      crCaught: [caught({ caughtDate: "2026-07-15" })],
      // aipMet and dipPolicy both end 2026-05-31
    });
    expect(r.activationIncentiveLost).toBe(0);
    expect(r.dealerIncentiveLost).toBe(0);
    // base and bonus still apply — neither is window-scoped
    expect(r.total).toBe(10_000);
  });

  it("applies a model-scoped activation incentive only to its own model's caught units", () => {
    const r = base({ crCaught: [caught({ modelId: MODEL_B })] });
    expect(r.activationIncentiveLost).toBe(0); // aipMet is scoped to MODEL_A
    expect(r.basePercentLost).toBe(8_000);
  });

  it("applies a model-scoped dealer incentive only to its own model", () => {
    const scoped = { ...dipPolicy, modelId: MODEL_A };
    const r = base({
      crCaught: [caught({ modelId: MODEL_B })],
      dealerIncentives: [{ policy: scoped, eligible: true }],
    });
    expect(r.dealerIncentiveLost).toBe(0);
  });
});

describe("cr-loss: empty input", () => {
  it("returns an all-zero result for no caught rows", () => {
    const r = base({ crCaught: [] });
    expect(r).toMatchObject({
      totalUnits: 0, basePercentLost: 0, bonusPercentLost: 0,
      activationIncentiveLost: 0, dealerIncentiveLost: 0, total: 0,
    });
    expect(r.components).toEqual([]);
  });
});

describe("cr-loss: stock-in is never counted", () => {
  it("has no stock-in component and no stock-in field", () => {
    const r = base();
    expect(r.components.some((c) => String(c.kind).includes("stockIn"))).toBe(false);
    expect(r).not.toHaveProperty("stockInLost");
    // total is exactly the four known components
    expect(r.total).toBe(
      r.basePercentLost + r.bonusPercentLost + r.activationIncentiveLost + r.dealerIncentiveLost
    );
  });
});

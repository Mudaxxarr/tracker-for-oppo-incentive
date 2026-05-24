import { describe, expect, it } from "vitest";
import { calculateIncentives } from "@/lib/incentive-engine";
import type { EngineInput } from "@/lib/incentive-engine/types";

const MODEL_A = { id: "model-a", name: "OPPO Reno 12 Pro 12+512" };
const MODEL_B = { id: "model-b", name: "OPPO A78 8+256" };

const baseInput = (over: Partial<EngineInput> = {}): EngineInput => ({
  dealerId: "dealer-1",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  baseIncentivePercent: 4,
  models: [MODEL_A, MODEL_B],
  activations: [],
  purchases: [],
  targetBonusPolicies: [],
  stockInPolicies: [],
  activationIncentivePolicies: [],
  dealerIncentivePolicies: [],
  ...over,
});

describe("incentive-engine: price snapshot integrity", () => {
  it("trusts each activation's dealerPriceSnapshot — old price stays old, new stays new", () => {
    // 2 phones activated at OLD price 100,000; 3 at NEW price 120,000.
    // Even though current price is now 120k, past activations remain at 100k.
    const result = calculateIncentives(
      baseInput({
        activations: [
          { id: "a1", modelId: MODEL_A.id, activationDate: "2026-05-05", dealerPriceSnapshot: 100_000, isCrossRegion: false },
          { id: "a2", modelId: MODEL_A.id, activationDate: "2026-05-09", dealerPriceSnapshot: 100_000, isCrossRegion: false },
          { id: "a3", modelId: MODEL_A.id, activationDate: "2026-05-15", dealerPriceSnapshot: 120_000, isCrossRegion: false },
          { id: "a4", modelId: MODEL_A.id, activationDate: "2026-05-22", dealerPriceSnapshot: 120_000, isCrossRegion: false },
          { id: "a5", modelId: MODEL_A.id, activationDate: "2026-05-29", dealerPriceSnapshot: 120_000, isCrossRegion: false },
        ],
      })
    );
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    expect(row.qtyActivated).toBe(5);
    // 4% on 2 * 100k = 8000; 4% on 3 * 120k = 14_400 → 22_400
    expect(row.basePercentEarned).toBe(22_400);
    expect(row.priceSubperiods).toHaveLength(2);
    expect(row.priceSubperiods[0]).toMatchObject({ dealerPrice: 100_000, qty: 2, basePercentSubtotal: 8_000 });
    expect(row.priceSubperiods[1]).toMatchObject({ dealerPrice: 120_000, qty: 3, basePercentSubtotal: 14_400 });
  });
});

describe("incentive-engine: target bonus (1%) gating", () => {
  it("fires when purchase target met by exactly the threshold (boundary)", () => {
    // Gate is on REGULAR purchase qty (50 units purchased = target met).
    // The 1% bonus then applies to all 50 activations.
    const result = calculateIncentives(
      baseInput({
        activations: Array.from({ length: 50 }, (_, i) => ({
          id: `a${i}`,
          modelId: MODEL_A.id,
          activationDate: "2026-05-10",
          dealerPriceSnapshot: 100_000,
          isCrossRegion: false,
        })),
        purchases: [
          { id: "p1", modelId: MODEL_A.id, quantity: 50, unitDealerPrice: 100_000, purchaseDate: "2026-05-05", source: "REGULAR" },
        ],
        targetBonusPolicies: [
          { id: "tbp1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetActivationsQty: 50, bonusPercent: 1 },
        ],
      })
    );
    expect(result.targetBonus.eligible).toBe(true);
    expect(result.targetBonus.actualQty).toBe(50); // purchase qty
    // 50 phones * 100k * 1% = 50_000
    expect(result.totals.bonusPercentEarned).toBe(50_000);
  });

  it("does NOT fire if purchase target not met — bonus must be 0", () => {
    // 49 regular purchases < target of 50; bonus stays 0 even with 49 activations.
    const result = calculateIncentives(
      baseInput({
        activations: Array.from({ length: 49 }, (_, i) => ({
          id: `a${i}`,
          modelId: MODEL_A.id,
          activationDate: "2026-05-10",
          dealerPriceSnapshot: 100_000,
          isCrossRegion: false,
        })),
        purchases: [
          { id: "p1", modelId: MODEL_A.id, quantity: 49, unitDealerPrice: 100_000, purchaseDate: "2026-05-05", source: "REGULAR" },
        ],
        targetBonusPolicies: [
          { id: "tbp1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetActivationsQty: 50, bonusPercent: 1 },
        ],
      })
    );
    expect(result.targetBonus.eligible).toBe(false);
    expect(result.targetBonus.actualQty).toBe(49); // purchase qty
    expect(result.totals.bonusPercentEarned).toBe(0);
    // base 4% should still be applied to activations
    expect(result.totals.basePercentEarned).toBe(49 * 100_000 * 0.04);
  });
});

describe("incentive-engine: cross-region exclusion from stock-in only", () => {
  it("cross-region phone earns 4% + 1% + activation + dealer incentive but NOT stock-in", () => {
    const result = calculateIncentives(
      baseInput({
        activations: [
          // 1 cross-region activation, 9 regular — 10 total to clear the 10-target.
          ...Array.from({ length: 9 }, (_, i) => ({
            id: `reg${i}`,
            modelId: MODEL_A.id,
            activationDate: "2026-05-12",
            dealerPriceSnapshot: 100_000,
            isCrossRegion: false,
          })),
          {
            id: "cr1",
            modelId: MODEL_A.id,
            activationDate: "2026-05-15",
            dealerPriceSnapshot: 100_000,
            isCrossRegion: true,
          },
        ],
        purchases: [
          // 10 regular (meets purchase target of 10), 5 cross-region (excluded from target gate + stock-in)
          { id: "p1", modelId: MODEL_A.id, quantity: 10, unitDealerPrice: 100_000, purchaseDate: "2026-05-02", source: "REGULAR" },
          { id: "p2", modelId: MODEL_A.id, quantity: 5, unitDealerPrice: 100_000, purchaseDate: "2026-05-04", source: "CROSS_REGION_TRANSFER_IN" },
        ],
        targetBonusPolicies: [
          { id: "tbp1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetActivationsQty: 10, bonusPercent: 1 },
        ],
        stockInPolicies: [
          { id: "sip1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 1_000, minQty: null },
        ],
        activationIncentivePolicies: [
          { id: "aip1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 500, targetQty: null },
        ],
        dealerIncentivePolicies: [
          { id: "dip1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetTotalActivations: 10, perUnitAmount: 200 },
        ],
      })
    );

    expect(result.totalActivations).toBe(10);
    expect(result.totalActivationsCrossRegion).toBe(1);
    expect(result.targetBonus.eligible).toBe(true);
    expect(result.dealerIncentives[0]?.eligible).toBe(true);

    // Per phone: 4% of 100k = 4000, 1% = 1000, activation = 500, dealer = 200 → 5700
    // 10 phones × 5700 = 57_000 from per-phone earnings.
    // Stock-in: 10 regular × 1000 = 10_000 (the 5 cross-region purchases yield NO stock-in).
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    expect(row.basePercentEarned).toBe(40_000);
    expect(row.bonusPercentEarned).toBe(10_000);
    expect(row.activationIncentiveEarned).toBe(5_000);
    expect(row.dealerIncentiveEarned).toBe(2_000);
    expect(row.stockInEarned).toBe(10_000);
    expect(row.stockInRegularQty).toBe(10);
    expect(row.stockInCrossRegionQty).toBe(5);
    expect(row.total).toBe(67_000);
  });
});

describe("incentive-engine: activation incentive target_qty gating", () => {
  it("fires when activations of model in window >= target_qty", () => {
    const result = calculateIncentives(
      baseInput({
        activations: Array.from({ length: 5 }, (_, i) => ({
          id: `a${i}`,
          modelId: MODEL_A.id,
          activationDate: "2026-05-10",
          dealerPriceSnapshot: 100_000,
          isCrossRegion: false,
        })),
        activationIncentivePolicies: [
          { id: "aip1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 500, targetQty: 5 },
        ],
      })
    );
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    expect(row.activationIncentiveEarned).toBe(2_500); // 5 × 500
  });

  it("does NOT fire if target_qty not met — activation incentive 0", () => {
    const result = calculateIncentives(
      baseInput({
        activations: Array.from({ length: 4 }, (_, i) => ({
          id: `a${i}`,
          modelId: MODEL_A.id,
          activationDate: "2026-05-10",
          dealerPriceSnapshot: 100_000,
          isCrossRegion: false,
        })),
        activationIncentivePolicies: [
          { id: "aip1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 500, targetQty: 5 },
        ],
      })
    );
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    expect(row.activationIncentiveEarned).toBe(0);
    expect(row.basePercentEarned).toBe(4 * 100_000 * 0.04); // still earns base 4%
  });
});

describe("incentive-engine: inter-ID transfer integrity", () => {
  it("phones present at SOURCE id appear in source's report; once transferred, only DEST id sees them going forward", () => {
    // Simulate: 3 phones bought at dealer-1, 1 transferred out before activation, then activated at dealer-2.
    // The engine doesn't model transfers directly — the purchase pool is decremented at source and a new purchase
    // is created at destination. The activation row carries the dealerId (via the loader). For the engine's purpose,
    // we test that activations are scoped to the correct dealer when the report runs.
    const dealer1Activations = [
      { id: "a1", modelId: MODEL_A.id, activationDate: "2026-05-10", dealerPriceSnapshot: 100_000, isCrossRegion: false },
      { id: "a2", modelId: MODEL_A.id, activationDate: "2026-05-12", dealerPriceSnapshot: 100_000, isCrossRegion: false },
    ];
    const dealer2Activations = [
      { id: "a3", modelId: MODEL_A.id, activationDate: "2026-05-15", dealerPriceSnapshot: 100_000, isCrossRegion: false },
    ];

    const r1 = calculateIncentives(baseInput({ dealerId: "dealer-1", activations: dealer1Activations }));
    const r2 = calculateIncentives(baseInput({ dealerId: "dealer-2", activations: dealer2Activations }));

    expect(r1.totalActivations).toBe(2);
    expect(r2.totalActivations).toBe(1);
    expect(r1.totals.basePercentEarned).toBe(2 * 100_000 * 0.04);
    expect(r2.totals.basePercentEarned).toBe(1 * 100_000 * 0.04);
  });
});

describe("incentive-engine: inter-ID source-side stock-in decrement", () => {
  it("subtracts outbound inter-ID transfers from source dealer's stock-in qty", () => {
    const result = calculateIncentives(
      baseInput({
        purchases: [
          // 10 regular at source, but 4 are about to leave via inter-ID transfer.
          { id: "p1", modelId: MODEL_A.id, quantity: 10, unitDealerPrice: 100_000, purchaseDate: "2026-05-02", source: "REGULAR" },
        ],
        stockInPolicies: [
          { id: "sip1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 1_000, minQty: null },
        ],
        interIdOut: [
          { id: "iid1", modelId: MODEL_A.id, quantity: 4, transferDate: "2026-05-08" },
        ],
      })
    );
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    expect(row.stockInRegularQty).toBe(10);
    expect(row.interIdOutQty).toBe(4);
    expect(row.effectiveStockInQty).toBe(6);
    expect(row.stockInEarned).toBe(6_000); // 6 effective × 1000
  });

  it("does not go negative if outbound exceeds regular qty", () => {
    const result = calculateIncentives(
      baseInput({
        purchases: [
          { id: "p1", modelId: MODEL_A.id, quantity: 2, unitDealerPrice: 100_000, purchaseDate: "2026-05-02", source: "REGULAR" },
        ],
        stockInPolicies: [
          { id: "sip1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 1_000, minQty: null },
        ],
        interIdOut: [
          { id: "iid1", modelId: MODEL_A.id, quantity: 5, transferDate: "2026-05-08" },
        ],
      })
    );
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    expect(row.effectiveStockInQty).toBe(0);
    expect(row.stockInEarned).toBe(0);
  });
});

describe("incentive-engine: stock-in min_qty gating + cross-region filter", () => {
  it("does not fire stock-in when REGULAR qty below min_qty even if cross-region transfers fill the gap", () => {
    const result = calculateIncentives(
      baseInput({
        purchases: [
          { id: "p1", modelId: MODEL_A.id, quantity: 4, unitDealerPrice: 100_000, purchaseDate: "2026-05-02", source: "REGULAR" },
          { id: "p2", modelId: MODEL_A.id, quantity: 10, unitDealerPrice: 100_000, purchaseDate: "2026-05-03", source: "CROSS_REGION_TRANSFER_IN" },
        ],
        stockInPolicies: [
          { id: "sip1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 1_000, minQty: 5 },
        ],
      })
    );
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    expect(row.stockInRegularQty).toBe(4);
    expect(row.stockInCrossRegionQty).toBe(10);
    expect(row.stockInEarned).toBe(0); // 4 < min_qty 5; cross-region purchases do not count.
  });
});

describe("incentive-engine: stock-in policy date window enforcement", () => {
  it("purchases outside the policy window earn zero stock-in even though they are in the report period", () => {
    // Policy covers only May 1–3. 6 regular units purchased May 1–3 (inside).
    // 4 more units purchased May 10 (outside). Only the 6 inside should earn.
    const result = calculateIncentives(
      baseInput({
        purchases: [
          { id: "p1", modelId: MODEL_A.id, quantity: 6, unitDealerPrice: 100_000, purchaseDate: "2026-05-02", source: "REGULAR" },
          { id: "p2", modelId: MODEL_A.id, quantity: 4, unitDealerPrice: 100_000, purchaseDate: "2026-05-10", source: "REGULAR" },
        ],
        stockInPolicies: [
          { id: "sip1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-03", perUnitAmount: 1_000, minQty: null },
        ],
      })
    );
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    // Only the 6 units within the policy window (May 1–3) count.
    expect(row.stockInRegularQty).toBe(6);
    expect(row.effectiveStockInQty).toBe(6);
    expect(row.stockInEarned).toBe(6_000); // 6 × 1000
  });

  it("purchases entirely outside the policy window earn nothing", () => {
    // 10 units purchased May 15, but policy only covers May 1–3 → zero stock-in earned.
    const result = calculateIncentives(
      baseInput({
        purchases: [
          { id: "p1", modelId: MODEL_A.id, quantity: 10, unitDealerPrice: 100_000, purchaseDate: "2026-05-15", source: "REGULAR" },
        ],
        stockInPolicies: [
          { id: "sip1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-03", perUnitAmount: 1_000, minQty: null },
        ],
      })
    );
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    // The row exists (the purchase is visible in the report period) but nothing earned.
    expect(row.stockInRegularQty).toBe(0); // none within the May 1–3 policy window
    expect(row.effectiveStockInQty).toBe(0);
    expect(row.stockInEarned).toBe(0);
  });
});

describe("incentive-engine: empty + edge cases", () => {
  it("returns zero totals on empty input", () => {
    const result = calculateIncentives(baseInput({}));
    expect(result.totals.grandTotal).toBe(0);
    expect(result.rows).toHaveLength(0);
    expect(result.targetBonus.eligible).toBe(false);
    expect(result.dealerIncentives).toHaveLength(0);
  });

  it("rejects an inverted period", () => {
    expect(() =>
      calculateIncentives(
        baseInput({ periodStart: "2026-05-31", periodEnd: "2026-05-01" })
      )
    ).toThrow();
  });
});

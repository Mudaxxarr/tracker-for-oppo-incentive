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

describe("incentive-engine: outbound transfers never reduce the source's stock-in", () => {
  it("stock-in stays on the full purchased qty even when some units leave via inter-ID transfer", () => {
    const result = calculateIncentives(
      baseInput({
        purchases: [
          // 10 regular at source; 4 later leave via inter-ID transfer — stock-in stays on all 10.
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
    expect(row.interIdOutQty).toBe(4);          // still reported for info
    expect(row.effectiveStockInQty).toBe(10);   // NOT 6 — the purchaser keeps it
    expect(row.stockInEarned).toBe(10_000);     // 10 × 1000
  });

  it("transferring out more than were purchased still keeps stock-in on the purchased qty", () => {
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
    expect(row.effectiveStockInQty).toBe(2);
    expect(row.stockInEarned).toBe(2_000);
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

describe("incentive-engine: combined stock-in policy (grouped target, per-model rate)", () => {
  const reg = (id: string, modelId: string, quantity: number) => ({
    id, modelId, quantity, unitDealerPrice: 50_000, purchaseDate: "2026-05-10", source: "REGULAR" as const,
  });
  const combined = {
    id: "cp1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetQty: 20,
    models: [{ modelId: MODEL_A.id, perUnitAmount: 500 }, { modelId: MODEL_B.id, perUnitAmount: 900 }],
  };

  it("target met by the group → each model paid on its FULL qty at its own rate", () => {
    // 12 of A + 8 of B = 20 combined = target. Earned: 12×500 + 8×900 = 13_200.
    const result = calculateIncentives(baseInput({
      purchases: [reg("p1", MODEL_A.id, 12), reg("p2", MODEL_B.id, 8)],
      combinedStockInPolicies: [combined],
    }));
    const led = result.combinedStockInLedger[0];
    expect(led.met).toBe(true);
    expect(led.combinedEligibleQty).toBe(20);
    expect(led.totalEarned).toBe(13_200);
    expect(result.rows.find((r) => r.modelId === MODEL_A.id)!.stockInEarned).toBe(6_000);
    expect(result.rows.find((r) => r.modelId === MODEL_B.id)!.stockInEarned).toBe(7_200);
    expect(result.totals.stockInEarned).toBe(13_200);
    expect(result.totals.grandTotal).toBe(13_200);
  });

  it("target NOT met by the group → nobody earns", () => {
    // 12 + 5 = 17 < 20.
    const result = calculateIncentives(baseInput({
      purchases: [reg("p1", MODEL_A.id, 12), reg("p2", MODEL_B.id, 5)],
      combinedStockInPolicies: [combined],
    }));
    expect(result.combinedStockInLedger[0].met).toBe(false);
    expect(result.rows.find((r) => r.modelId === MODEL_A.id)!.stockInEarned).toBe(0);
    expect(result.totals.stockInEarned).toBe(0);
  });

  it("qty beyond the target → the WHOLE qty is paid (target is only a trigger)", () => {
    // 25 + 15 = 40. Earned: 25×500 + 15×900 = 26_000.
    const result = calculateIncentives(baseInput({
      purchases: [reg("p1", MODEL_A.id, 25), reg("p2", MODEL_B.id, 15)],
      combinedStockInPolicies: [combined],
    }));
    expect(result.combinedStockInLedger[0].totalEarned).toBe(26_000);
    expect(result.rows.find((r) => r.modelId === MODEL_A.id)!.stockInEarned).toBe(12_500);
    expect(result.rows.find((r) => r.modelId === MODEL_B.id)!.stockInEarned).toBe(13_500);
  });

  it("outbound transfers do NOT reduce the combined eligible qty (purchaser keeps it)", () => {
    // 12 A + 12 B = 24 purchased; 4 B leave via transfer but combined qty stays 24.
    const result = calculateIncentives(baseInput({
      purchases: [reg("p1", MODEL_A.id, 12), reg("p2", MODEL_B.id, 12)],
      interIdOut: [{ id: "t1", modelId: MODEL_B.id, quantity: 4, transferDate: "2026-05-15" }],
      combinedStockInPolicies: [combined],
    }));
    const led = result.combinedStockInLedger[0];
    expect(led.combinedEligibleQty).toBe(24); // NOT 20 — transfer out ignored
    expect(led.met).toBe(true);
    expect(result.rows.find((r) => r.modelId === MODEL_B.id)!.stockInEarned).toBe(10_800); // 12 × 900
  });

  it("one model can carry the whole target; a zero-qty group member earns 0", () => {
    // 20 A + 0 B = 20 (met). A earns 20×500=10_000; B earns 0.
    const result = calculateIncentives(baseInput({
      purchases: [reg("p1", MODEL_A.id, 20)],
      combinedStockInPolicies: [combined],
    }));
    const led = result.combinedStockInLedger[0];
    expect(led.met).toBe(true);
    expect(led.perModel.find((m) => m.modelId === MODEL_B.id)!.earned).toBe(0);
    expect(result.rows.find((r) => r.modelId === MODEL_A.id)!.stockInEarned).toBe(10_000);
    expect(result.totals.stockInEarned).toBe(10_000);
  });
});

describe("incentive-engine: transfer stock-in rules (purchaser keeps stock-in)", () => {
  const reg = (id: string, modelId: string, qty: number, date = "2026-05-05") => ({
    id, modelId, quantity: qty, unitDealerPrice: 50_000, purchaseDate: date, source: "REGULAR" as const,
  });

  it("#1 source keeps FULL stock-in after transferring units out (transfer out never reverses stock-in)", () => {
    const result = calculateIncentives(baseInput({
      purchases: [reg("p1", MODEL_A.id, 20)],
      interIdOut: [{ id: "t1", modelId: MODEL_A.id, quantity: 10, transferDate: "2026-05-10" }],
      stockInPolicies: [{ id: "s1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 1000, minQty: 10 }],
    }));
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    expect(row.stockInEarned).toBe(20_000); // 20 × 1000, NOT (20-10) × 1000
    expect(row.effectiveStockInQty).toBe(20);
  });

  it("#2 stock received via inter-ID transfer earns no stock-in and does not count toward the target-bonus gate", () => {
    const result = calculateIncentives(baseInput({
      purchases: [
        reg("p1", MODEL_A.id, 10),
        { id: "p2", modelId: MODEL_A.id, quantity: 10, unitDealerPrice: 50_000, purchaseDate: "2026-05-06", source: "INTER_ID_TRANSFER_IN" as const },
      ],
      activations: [{ id: "a1", modelId: MODEL_A.id, activationDate: "2026-05-15", dealerPriceSnapshot: 100_000, isCrossRegion: false }],
      stockInPolicies: [{ id: "s1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 1000, minQty: 5 }],
      targetBonusPolicies: [{ id: "tb1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetActivationsQty: 15, bonusPercent: 1 }],
    }));
    const row = result.rows.find((r) => r.modelId === MODEL_A.id)!;
    expect(row.stockInEarned).toBe(10_000);       // only the 10 REGULAR, transfer-in excluded
    expect(result.targetBonus.eligible).toBe(false); // REGULAR gate qty = 10 < 15 (transfer-in doesn't count)
    expect(row.bonusPercentEarned).toBe(0);
  });

  it("#3 an outbound transfer (any status) has zero effect on stock-in earning", () => {
    const noTransfer = calculateIncentives(baseInput({
      purchases: [reg("p1", MODEL_A.id, 15)],
      stockInPolicies: [{ id: "s1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 500, minQty: 5 }],
    }));
    const withTransfer = calculateIncentives(baseInput({
      purchases: [reg("p1", MODEL_A.id, 15)],
      interIdOut: [{ id: "t1", modelId: MODEL_A.id, quantity: 8, transferDate: "2026-05-12" }],
      stockInPolicies: [{ id: "s1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 500, minQty: 5 }],
    }));
    const a = noTransfer.rows.find((r) => r.modelId === MODEL_A.id)!.stockInEarned;
    const b = withTransfer.rows.find((r) => r.modelId === MODEL_A.id)!.stockInEarned;
    expect(a).toBe(7_500);
    expect(b).toBe(7_500); // identical — the transfer out changed nothing
  });
});

describe("incentive-engine: CR-caught potential loss", () => {
  it("reports zero loss when no CR-caught rows are supplied", () => {
    const result = calculateIncentives(baseInput());
    expect(result.potentialLoss.total).toBe(0);
    expect(result.potentialLoss.totalUnits).toBe(0);
  });

  it("uses the report's own resolved gates, not a re-derivation", () => {
    // 50 REGULAR purchases meet the 1% target-bonus gate of 50.
    const result = calculateIncentives(
      baseInput({
        purchases: [
          { id: "p1", modelId: MODEL_A.id, quantity: 50, unitDealerPrice: 100_000, purchaseDate: "2026-05-02", source: "REGULAR" },
        ],
        targetBonusPolicies: [
          { id: "tbp1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetActivationsQty: 50, bonusPercent: 1 },
        ],
        crCaught: [
          { id: "cr1", modelId: MODEL_A.id, quantity: 2, caughtDate: "2026-05-20", dealerPriceSnapshot: 100_000 },
        ],
      })
    );
    expect(result.targetBonus.eligible).toBe(true);
    // base 4% on 2 * 100k = 8,000; bonus 1% = 2,000
    expect(result.potentialLoss.basePercentLost).toBe(8_000);
    expect(result.potentialLoss.bonusPercentLost).toBe(2_000);
    expect(result.potentialLoss.total).toBe(10_000);
  });

  it("drops the bonus from the loss when the report's bonus gate was missed", () => {
    const result = calculateIncentives(
      baseInput({
        purchases: [
          { id: "p1", modelId: MODEL_A.id, quantity: 10, unitDealerPrice: 100_000, purchaseDate: "2026-05-02", source: "REGULAR" },
        ],
        targetBonusPolicies: [
          { id: "tbp1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetActivationsQty: 50, bonusPercent: 1 },
        ],
        crCaught: [
          { id: "cr1", modelId: MODEL_A.id, quantity: 2, caughtDate: "2026-05-20", dealerPriceSnapshot: 100_000 },
        ],
      })
    );
    expect(result.targetBonus.eligible).toBe(false);
    expect(result.potentialLoss.bonusPercentLost).toBe(0);
    expect(result.potentialLoss.total).toBe(8_000);
  });

  it("never lets a met stock-in policy leak into the loss", () => {
    const result = calculateIncentives(
      baseInput({
        purchases: [
          { id: "p1", modelId: MODEL_A.id, quantity: 20, unitDealerPrice: 100_000, purchaseDate: "2026-05-02", source: "REGULAR" },
        ],
        stockInPolicies: [
          { id: "sip1", modelId: MODEL_A.id, periodStart: "2026-05-01", periodEnd: "2026-05-31", perUnitAmount: 1_000, minQty: 5 },
        ],
        crCaught: [
          { id: "cr1", modelId: MODEL_A.id, quantity: 2, caughtDate: "2026-05-20", dealerPriceSnapshot: 100_000 },
        ],
      })
    );
    expect(result.totals.stockInEarned).toBe(20_000); // stock-in did pay
    expect(result.potentialLoss.total).toBe(8_000);   // but contributes nothing to the loss
  });
});

describe("incentive-engine: target-bonus activation cap (#6)", () => {
  // Gate is on purchases; the cap is on activations. They are independent.
  const gateMetPurchase = {
    id: "p1", modelId: MODEL_A.id, quantity: 600, unitDealerPrice: 100_000,
    purchaseDate: "2026-05-02", source: "REGULAR" as const,
  };
  const acts = (n: number, startDay = 1) =>
    Array.from({ length: n }, (_, i) => ({
      id: `a${startDay}-${i}`,
      modelId: MODEL_A.id,
      // spread across the month so chronological order is well defined
      activationDate: `2026-05-${String(Math.min(28, startDay + Math.floor(i / 40))).padStart(2, "0")}`,
      dealerPriceSnapshot: 100_000,
      isCrossRegion: false,
    }));

  it("pays the bonus on every activation when no cap is set (unchanged behaviour)", () => {
    const r = calculateIncentives(
      baseInput({
        purchases: [gateMetPurchase],
        activations: acts(700),
        targetBonusPolicies: [
          { id: "tbp1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetActivationsQty: 600, bonusPercent: 1 },
        ],
      })
    );
    expect(r.targetBonus.eligible).toBe(true);
    expect(r.targetBonus.bonusCapQty).toBeNull();
    expect(r.targetBonus.bonusEligibleQty).toBe(700);
    // 1% of 100k = 1,000 per phone
    expect(r.totals.bonusPercentEarned).toBe(700_000);
  });

  it("pays the bonus on only the first N activations when capped", () => {
    const r = calculateIncentives(
      baseInput({
        purchases: [gateMetPurchase],
        activations: acts(700),
        targetBonusPolicies: [
          { id: "tbp1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetActivationsQty: 600, bonusPercent: 1, bonusCapQty: 500 },
        ],
      })
    );
    expect(r.targetBonus.bonusCapQty).toBe(500);
    expect(r.targetBonus.bonusEligibleQty).toBe(500);
    expect(r.targetBonus.policyWindowActivations).toBe(700);
    expect(r.totals.bonusPercentEarned).toBe(500_000);
    // base % is untouched by the cap — all 700 still earn it
    expect(r.totals.basePercentEarned).toBe(700 * 100_000 * 0.04);
  });

  it("leaves the bonus alone when the cap exceeds the activation count", () => {
    const r = calculateIncentives(
      baseInput({
        purchases: [gateMetPurchase],
        activations: acts(100),
        targetBonusPolicies: [
          { id: "tbp1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetActivationsQty: 600, bonusPercent: 1, bonusCapQty: 500 },
        ],
      })
    );
    expect(r.targetBonus.bonusEligibleQty).toBe(100);
    expect(r.totals.bonusPercentEarned).toBe(100_000);
  });

  it("counts the cap across the POLICY window, not the report window", () => {
    // Policy runs May-June with a cap of 5. Ten phones activate in May, five in June.
    // Reporting on June alone must show ZERO bonus: May already used the whole cap.
    const may = Array.from({ length: 10 }, (_, i) => ({
      id: `may${i}`, modelId: MODEL_A.id, activationDate: "2026-05-10",
      dealerPriceSnapshot: 100_000, isCrossRegion: false,
    }));
    const june = Array.from({ length: 5 }, (_, i) => ({
      id: `jun${i}`, modelId: MODEL_A.id, activationDate: "2026-06-10",
      dealerPriceSnapshot: 100_000, isCrossRegion: false,
    }));
    const r = calculateIncentives(
      baseInput({
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        purchases: [{ ...gateMetPurchase, quantity: 20 }],
        activations: [...may, ...june],
        targetBonusPolicies: [
          { id: "tbp1", periodStart: "2026-05-01", periodEnd: "2026-06-30", targetActivationsQty: 20, bonusPercent: 1, bonusCapQty: 5 },
        ],
      })
    );
    expect(r.targetBonus.eligible).toBe(true);
    expect(r.targetBonus.bonusEligibleQty).toBe(5);
    expect(r.totals.bonusPercentEarned).toBe(0); // all 5 capped slots were used in May
    // June's five phones still earn their base %
    expect(r.totals.basePercentEarned).toBe(5 * 100_000 * 0.04);
  });

  it("reflects the cap in the price sub-period bonus subtotals", () => {
    const r = calculateIncentives(
      baseInput({
        purchases: [gateMetPurchase],
        activations: acts(700),
        targetBonusPolicies: [
          { id: "tbp1", periodStart: "2026-05-01", periodEnd: "2026-05-31", targetActivationsQty: 600, bonusPercent: 1, bonusCapQty: 500 },
        ],
      })
    );
    const row = r.rows.find((x) => x.modelId === MODEL_A.id)!;
    const bonusFromSubperiods = row.priceSubperiods.reduce((s, p) => s + p.bonusPercentSubtotal, 0);
    expect(bonusFromSubperiods).toBe(row.bonusPercentEarned);
    expect(bonusFromSubperiods).toBe(500_000);
  });
});

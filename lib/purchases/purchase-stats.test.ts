import { describe, expect, it } from "vitest";
import { formatBillNumber, computePreviousPeriod, percentChange, groupIntoBills, aggregatePurchaseStats, type PurchaseStatsRow } from "@/lib/purchases/purchase-stats";

describe("formatBillNumber", () => {
  it("formats YYMMDD + zero-padded 3-digit sequence", () => {
    expect(formatBillNumber("2025-05-31", 1)).toBe("INV-250531-001");
    expect(formatBillNumber("2025-05-01", 12)).toBe("INV-250501-012");
  });
});

describe("computePreviousPeriod", () => {
  it("shifts an equal-length window immediately before `from`", () => {
    expect(computePreviousPeriod("2026-05-01", "2026-05-31")).toEqual({
      from: "2026-03-31",
      to: "2026-04-30",
    });
  });
  it("handles a single-day range", () => {
    expect(computePreviousPeriod("2026-05-10", "2026-05-10")).toEqual({
      from: "2026-05-09",
      to: "2026-05-09",
    });
  });
});

describe("percentChange", () => {
  it("computes a positive percent increase", () => {
    expect(percentChange(115, 100)).toBe(15);
  });
  it("returns null when previous is 0 (undefined growth base)", () => {
    expect(percentChange(50, 0)).toBeNull();
  });
  it("rounds to one decimal", () => {
    expect(percentChange(133, 100)).toBe(33);
    expect(percentChange(101, 3)).toBeCloseTo(3266.7, 1);
  });
});

const row = (over: Partial<PurchaseStatsRow>): PurchaseStatsRow => ({
  billNumber: "INV-250531-001",
  modelId: "m1",
  modelName: "OPPO Reno 12",
  quantity: 10,
  unitDealerPrice: 32_999,
  purchaseDate: "2025-05-31",
  source: "REGULAR",
  ...over,
});

describe("groupIntoBills", () => {
  it("groups multiple lines sharing a bill number into one BillGroup", () => {
    const rows = [
      row({ modelId: "m1", modelName: "OPPO Reno 12", quantity: 10, unitDealerPrice: 32_999 }),
      row({ modelId: "m2", modelName: "Vivo V30", quantity: 8, unitDealerPrice: 29_999 }),
    ];
    const bills = groupIntoBills(rows);
    expect(bills).toHaveLength(1);
    expect(bills[0].billNumber).toBe("INV-250531-001");
    expect(bills[0].modelCount).toBe(2);
    expect(bills[0].totalQty).toBe(18);
    expect(bills[0].totalAmount).toBe(10 * 32_999 + 8 * 29_999);
    expect(bills[0].lines).toHaveLength(2);
  });

  it("sorts newest date first, then bill number descending within a date", () => {
    const rows = [
      row({ billNumber: "INV-250530-001", purchaseDate: "2025-05-30" }),
      row({ billNumber: "INV-250531-002", purchaseDate: "2025-05-31" }),
      row({ billNumber: "INV-250531-001", purchaseDate: "2025-05-31" }),
    ];
    const bills = groupIntoBills(rows);
    expect(bills.map((b) => b.billNumber)).toEqual(["INV-250531-002", "INV-250531-001", "INV-250530-001"]);
  });
});

describe("aggregatePurchaseStats", () => {
  it("computes bill count, totals, averages and cross-region qty", () => {
    const rows = [
      row({ billNumber: "INV-250531-001", modelId: "m1", quantity: 10, unitDealerPrice: 100, source: "REGULAR" }),
      row({ billNumber: "INV-250531-001", modelId: "m2", quantity: 5, unitDealerPrice: 200, source: "CROSS_REGION_TRANSFER_IN" }),
      row({ billNumber: "INV-250530-001", modelId: "m1", quantity: 4, unitDealerPrice: 100, source: "REGULAR" }),
    ];
    const stats = aggregatePurchaseStats(rows);
    expect(stats.billCount).toBe(2);
    expect(stats.totalQty).toBe(19);
    expect(stats.totalAmount).toBe(10 * 100 + 5 * 200 + 4 * 100);
    expect(stats.uniqueModels).toBe(2);
    expect(stats.crossRegionQty).toBe(5);
    expect(stats.avgQtyPerBill).toBeCloseTo(19 / 2);
    expect(stats.avgAmountPerBill).toBeCloseTo(stats.totalAmount / 2);
  });

  it("finds highest and lowest bill by amount", () => {
    const rows = [
      row({ billNumber: "A", purchaseDate: "2025-05-01", quantity: 1, unitDealerPrice: 1_000 }),
      row({ billNumber: "B", purchaseDate: "2025-05-02", quantity: 1, unitDealerPrice: 50_000 }),
    ];
    const stats = aggregatePurchaseStats(rows);
    expect(stats.highestBill?.billNumber).toBe("B");
    expect(stats.lowestBill?.billNumber).toBe("A");
  });

  it("returns top 5 models by quantity, descending", () => {
    const rows = [
      row({ modelId: "m1", modelName: "A", quantity: 5 }),
      row({ modelId: "m2", modelName: "B", quantity: 20 }),
      row({ modelId: "m3", modelName: "C", quantity: 10 }),
    ];
    const stats = aggregatePurchaseStats(rows);
    expect(stats.topModels.map((m) => m.modelId)).toEqual(["m2", "m3", "m1"]);
  });

  it("returns zeroed stats and empty extremes for no rows", () => {
    const stats = aggregatePurchaseStats([]);
    expect(stats.billCount).toBe(0);
    expect(stats.totalAmount).toBe(0);
    expect(stats.avgPricePerUnit).toBe(0);
    expect(stats.highestBill).toBeNull();
    expect(stats.lowestBill).toBeNull();
    expect(stats.topModels).toEqual([]);
    expect(stats.dailySeries).toEqual([]);
  });
});

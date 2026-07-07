import { describe, expect, it } from "vitest";
import { formatBillNumber, computePreviousPeriod, percentChange } from "@/lib/purchases/purchase-stats";

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

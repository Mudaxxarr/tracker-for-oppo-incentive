import { describe, expect, it } from "vitest";
import {
  aggregateActivationStats,
  groupActivationsByDate,
  type ActivationStatsRow,
} from "@/lib/activations/activation-stats";

const row = (over: Partial<ActivationStatsRow>): ActivationStatsRow => ({
  modelId: "m1",
  modelName: "OPPO Reno 12",
  activationDate: "2026-05-31",
  dealerPriceSnapshot: 32_999,
  isCrossRegion: false,
  ...over,
});

describe("aggregateActivationStats", () => {
  it("counts totals, cross-region split, unique models and dealer value", () => {
    const rows = [
      row({ modelId: "m1", dealerPriceSnapshot: 100, isCrossRegion: false }),
      row({ modelId: "m2", dealerPriceSnapshot: 200, isCrossRegion: true }),
      row({ modelId: "m1", dealerPriceSnapshot: 100, isCrossRegion: false }),
      row({ modelId: "m1", dealerPriceSnapshot: 100, isCrossRegion: true }),
    ];
    const s = aggregateActivationStats(rows);
    expect(s.totalActivations).toBe(4);
    expect(s.crossRegionCount).toBe(2);
    expect(s.regularCount).toBe(2);
    expect(s.crossRegionPercent).toBe(50);
    expect(s.uniqueModels).toBe(2);
    expect(s.totalDealerValue).toBe(500);
    expect(s.avgDealerPrice).toBe(125);
  });

  it("returns top 5 models by activation count, descending", () => {
    const rows = [
      row({ modelId: "m1", modelName: "A" }),
      row({ modelId: "m2", modelName: "B" }),
      row({ modelId: "m2", modelName: "B" }),
      row({ modelId: "m3", modelName: "C" }),
      row({ modelId: "m3", modelName: "C" }),
      row({ modelId: "m3", modelName: "C" }),
    ];
    const s = aggregateActivationStats(rows);
    expect(s.topModels.map((m) => m.modelId)).toEqual(["m3", "m2", "m1"]);
    expect(s.topModels[0].count).toBe(3);
  });

  it("builds an ascending daily series and finds the busiest day", () => {
    const rows = [
      row({ activationDate: "2026-05-01" }),
      row({ activationDate: "2026-05-03" }),
      row({ activationDate: "2026-05-03" }),
    ];
    const s = aggregateActivationStats(rows);
    expect(s.dailySeries).toEqual([
      { date: "2026-05-01", count: 1 },
      { date: "2026-05-03", count: 2 },
    ]);
    expect(s.activeDays).toBe(2);
    expect(s.avgPerActiveDay).toBeCloseTo(3 / 2);
    expect(s.busiestDay).toEqual({ date: "2026-05-03", count: 2 });
  });

  it("returns zeroed stats for no rows", () => {
    const s = aggregateActivationStats([]);
    expect(s.totalActivations).toBe(0);
    expect(s.crossRegionPercent).toBe(0);
    expect(s.avgDealerPrice).toBe(0);
    expect(s.avgPerActiveDay).toBe(0);
    expect(s.busiestDay).toBeNull();
    expect(s.topModels).toEqual([]);
    expect(s.dailySeries).toEqual([]);
  });
});

describe("groupActivationsByDate", () => {
  it("groups by date newest-first with a per-model breakdown", () => {
    const rows = [
      row({ activationDate: "2026-06-28", modelId: "m1", modelName: "A", dealerPriceSnapshot: 100, isCrossRegion: false }),
      row({ activationDate: "2026-06-28", modelId: "m1", modelName: "A", dealerPriceSnapshot: 100, isCrossRegion: true }),
      row({ activationDate: "2026-06-28", modelId: "m2", modelName: "B", dealerPriceSnapshot: 200, isCrossRegion: false }),
      row({ activationDate: "2026-06-27", modelId: "m1", modelName: "A", dealerPriceSnapshot: 100, isCrossRegion: false }),
    ];
    const groups = groupActivationsByDate(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe("2026-06-28");
    expect(groups[0].count).toBe(3);
    expect(groups[0].crossRegionCount).toBe(1);
    expect(groups[0].totalDealerValue).toBe(400);
    // m1 (count 2) sorts before m2 (count 1)
    expect(groups[0].models.map((m) => m.modelId)).toEqual(["m1", "m2"]);
    expect(groups[0].models[0].count).toBe(2);
    expect(groups[1].date).toBe("2026-06-27");
    expect(groups[1].count).toBe(1);
  });
});

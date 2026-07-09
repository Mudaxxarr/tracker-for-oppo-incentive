// Pure, DB-free aggregations for the activation Overview.
// Count-based metrics only — the money/policy figures (incentive earned, target
// progress) come from the incentive-engine in the query layer, never here.

export interface ActivationStatsRow {
  modelId: string;
  modelName: string;
  activationDate: string;
  dealerPriceSnapshot: number;
  isCrossRegion: boolean;
}

export interface ActivationTopModel {
  modelId: string;
  modelName: string;
  count: number;
}

export interface ActivationDailyPoint {
  date: string;
  count: number;
}

export interface DayExtreme {
  date: string;
  count: number;
}

export interface ActivationAggregateStats {
  totalActivations: number;
  regularCount: number;
  crossRegionCount: number;
  /** Cross-region share as a percentage, one decimal. 0 when there are no rows. */
  crossRegionPercent: number;
  uniqueModels: number;
  /** Sum of dealer-price snapshots (cost basis, not retail revenue). */
  totalDealerValue: number;
  avgDealerPrice: number;
  activeDays: number;
  avgPerActiveDay: number;
  busiestDay: DayExtreme | null;
  topModels: ActivationTopModel[];
  dailySeries: ActivationDailyPoint[];
}

export function aggregateActivationStats(rows: ActivationStatsRow[]): ActivationAggregateStats {
  const totalActivations = rows.length;
  const crossRegionCount = rows.filter((r) => r.isCrossRegion).length;
  const totalDealerValue = rows.reduce((s, r) => s + r.dealerPriceSnapshot, 0);

  const modelCount = new Map<string, { modelName: string; count: number }>();
  for (const r of rows) {
    const existing = modelCount.get(r.modelId);
    if (existing) existing.count += 1;
    else modelCount.set(r.modelId, { modelName: r.modelName, count: 1 });
  }
  const topModels: ActivationTopModel[] = [...modelCount.entries()]
    .map(([modelId, v]) => ({ modelId, modelName: v.modelName, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const dailyMap = new Map<string, number>();
  for (const r of rows) {
    dailyMap.set(r.activationDate, (dailyMap.get(r.activationDate) ?? 0) + 1);
  }
  const dailySeries: ActivationDailyPoint[] = [...dailyMap.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  let busiestDay: DayExtreme | null = null;
  for (const point of dailySeries) {
    // Ties resolve to the earlier date (dailySeries is ascending, strict `>`).
    if (!busiestDay || point.count > busiestDay.count) busiestDay = { ...point };
  }

  const activeDays = dailyMap.size;

  return {
    totalActivations,
    regularCount: totalActivations - crossRegionCount,
    crossRegionCount,
    crossRegionPercent: totalActivations > 0 ? Math.round((crossRegionCount / totalActivations) * 1000) / 10 : 0,
    uniqueModels: modelCount.size,
    totalDealerValue,
    avgDealerPrice: totalActivations > 0 ? totalDealerValue / totalActivations : 0,
    activeDays,
    avgPerActiveDay: activeDays > 0 ? totalActivations / activeDays : 0,
    busiestDay,
    topModels,
    dailySeries,
  };
}

export interface ActivationDateModel {
  modelId: string;
  modelName: string;
  count: number;
  crossRegionCount: number;
}

export interface ActivationDateGroup {
  date: string;
  count: number;
  crossRegionCount: number;
  totalDealerValue: number;
  models: ActivationDateModel[];
}

/** Groups activations under their date (newest first) with a per-model breakdown, for the timeline view. */
export function groupActivationsByDate(rows: ActivationStatsRow[]): ActivationDateGroup[] {
  const byDate = new Map<string, ActivationDateGroup & { modelMap: Map<string, ActivationDateModel> }>();
  for (const r of rows) {
    let group = byDate.get(r.activationDate);
    if (!group) {
      group = { date: r.activationDate, count: 0, crossRegionCount: 0, totalDealerValue: 0, models: [], modelMap: new Map() };
      byDate.set(r.activationDate, group);
    }
    group.count += 1;
    if (r.isCrossRegion) group.crossRegionCount += 1;
    group.totalDealerValue += r.dealerPriceSnapshot;
    let model = group.modelMap.get(r.modelId);
    if (!model) {
      model = { modelId: r.modelId, modelName: r.modelName, count: 0, crossRegionCount: 0 };
      group.modelMap.set(r.modelId, model);
    }
    model.count += 1;
    if (r.isCrossRegion) model.crossRegionCount += 1;
  }

  return [...byDate.values()]
    .map(({ modelMap, ...group }) => ({
      ...group,
      models: [...modelMap.values()].sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

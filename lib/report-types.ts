export interface PolicyAchievementEntry {
  type: "target-bonus" | "stock-in" | "activation-incentive" | "dealer-incentive";
  modelName: string | null;
  periodStart: string;
  periodEnd: string;
  targetQty: number | null;
  perUnitAmount: number;
  actualQty: number;
  /** For stock-in: per-policy eligible qty (regular purchases − inter-ID out in policy window). */
  eligibleQty?: number;
  earned: number;
  eligible: boolean;
}

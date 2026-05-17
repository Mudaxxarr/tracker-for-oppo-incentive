export interface PolicyAchievementEntry {
  type: "target-bonus" | "stock-in" | "activation-incentive" | "dealer-incentive";
  modelName: string | null;
  periodStart: string;
  periodEnd: string;
  targetQty: number | null;
  perUnitAmount: number;
  actualQty: number;
  earned: number;
  eligible: boolean;
}

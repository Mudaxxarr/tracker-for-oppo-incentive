/**
 * Engine inputs are plain data — the engine never queries the DB itself.
 * This makes the calculator a pure, unit-testable function.
 *
 * All `Date`-shaped fields are ISO `YYYY-MM-DD` strings so lexical comparison
 * gives correct chronological ordering.
 */

export type ISODate = string;

export type EnginePurchaseSource = "REGULAR" | "CROSS_REGION_TRANSFER_IN";

export interface EngineActivation {
  id: string;
  modelId: string;
  activationDate: ISODate;
  dealerPriceSnapshot: number;
  isCrossRegion: boolean;
}

export interface EnginePurchase {
  id: string;
  modelId: string;
  quantity: number;
  unitDealerPrice: number;
  purchaseDate: ISODate;
  source: EnginePurchaseSource;
}

export interface EngineTargetBonusPolicy {
  id: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  targetActivationsQty: number;
  bonusPercent: number;
}

export interface EngineStockInPolicy {
  id: string;
  modelId: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  perUnitAmount: number;
  minQty: number | null;
}

export interface EngineActivationIncentivePolicy {
  id: string;
  modelId: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  perUnitAmount: number;
  targetQty: number | null;
}

export interface EngineDealerIncentivePolicy {
  id: string;
  /** When set, only activations of this model count toward the target and earn the incentive. */
  modelId?: string | null;
  periodStart: ISODate;
  periodEnd: ISODate;
  targetTotalActivations: number;
  perUnitAmount: number;
}

/** Outbound inter-ID transfers for the dealer being reported on.
 *  Used to subtract phones that physically left this ID when computing stock-in. */
export interface EngineInterIdOut {
  id: string;
  modelId: string;
  quantity: number;
  transferDate: ISODate;
}

export interface EngineModel {
  id: string;
  name: string;
}

export interface EngineInput {
  dealerId: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  baseIncentivePercent: number; // default 4
  models: EngineModel[];
  /**
   * Activations that fall in the report period AND/OR in any relevant
   * policy window (for target gating). The engine filters appropriately.
   */
  activations: EngineActivation[];
  purchases: EnginePurchase[];
  targetBonusPolicies: EngineTargetBonusPolicy[];
  stockInPolicies: EngineStockInPolicy[];
  activationIncentivePolicies: EngineActivationIncentivePolicy[];
  dealerIncentivePolicies: EngineDealerIncentivePolicy[];
  /** Phones that left this dealer ID via inter-ID transfer; subtracted from stock-in qty. */
  interIdOut?: EngineInterIdOut[];
}

// ---------- Report types ----------

export interface PriceSubperiod {
  dealerPrice: number;
  qty: number;
  basePercentSubtotal: number;
  bonusPercentSubtotal: number;
}

export interface IncentiveReportRow {
  modelId: string;
  modelName: string;

  qtyActivated: number;
  qtyActivatedCrossRegion: number;

  priceSubperiods: PriceSubperiod[];

  basePercentEarned: number;
  bonusPercentEarned: number;
  activationIncentiveEarned: number;
  dealerIncentiveEarned: number;

  stockInRegularQty: number;
  stockInCrossRegionQty: number;
  /** Phones that left via inter-ID transfer in the report period (subtracted from stock-in qty). */
  interIdOutQty: number;
  /** Effective qty used for stock-in calculation: max(0, regular − interIdOut). */
  effectiveStockInQty: number;
  stockInEarned: number;

  total: number;
}

export interface TargetBonusOutcome {
  policyId: string | null;
  eligible: boolean;
  targetQty: number | null;
  actualQty: number;
  bonusPercent: number;
}

export interface DealerIncentiveOutcome {
  policyId: string;
  modelId: string | null;
  eligible: boolean;
  targetTotal: number;
  actualTotal: number;
  perUnitAmount: number;
  earned: number;
}

export interface IncentiveReport {
  dealerId: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  baseIncentivePercent: number;

  totalActivations: number;
  totalActivationsCrossRegion: number;
  totalRegularPurchaseQty: number;
  totalCrossRegionPurchaseQty: number;

  targetBonus: TargetBonusOutcome;
  dealerIncentives: DealerIncentiveOutcome[];

  rows: IncentiveReportRow[];

  totals: {
    basePercentEarned: number;
    bonusPercentEarned: number;
    activationIncentiveEarned: number;
    dealerIncentiveEarned: number;
    stockInEarned: number;
    grandTotal: number;
  };
}

/**
 * Engine inputs are plain data — the engine never queries the DB itself.
 * This makes the calculator a pure, unit-testable function.
 *
 * All `Date`-shaped fields are ISO `YYYY-MM-DD` strings so lexical comparison
 * gives correct chronological ordering.
 */

export type ISODate = string;

export type EnginePurchaseSource = "REGULAR" | "CROSS_REGION_TRANSFER_IN" | "INTER_ID_TRANSFER_IN";

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

/**
 * A stock-in policy whose target quantity is counted across a GROUP of models
 * combined, while the payout rate stays per-model. Evaluated as a separate pass
 * from the per-model `EngineStockInPolicy` (which is unchanged).
 */
export interface EngineCombinedStockInPolicy {
  id: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  /** Combined target across all models in the group. Only a trigger — once met,
   *  each model is paid on its FULL eligible qty (like per-model stock-in). */
  targetQty: number;
  models: { modelId: string; perUnitAmount: number }[];
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

/** A cross-region-caught record: stock that left this ID and was caught. */
export interface EngineCrCaught {
  id: string;
  modelId: string;
  quantity: number;
  caughtDate: ISODate;
  dealerPriceSnapshot: number;
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
  /** Grouped stock-in policies (target counted across models, per-model rate). */
  combinedStockInPolicies?: EngineCombinedStockInPolicy[];
  /** Phones that left this dealer ID via inter-ID transfer; subtracted from stock-in qty. */
  interIdOut?: EngineInterIdOut[];
  /** CR-caught rows in the report window. Drives `potentialLoss`. Omit to skip the calculation. */
  crCaught?: EngineCrCaught[];
}

// ---------- Report types ----------

export interface PriceSubperiod {
  dealerPrice: number;
  qty: number;
  basePercentSubtotal: number;
  bonusPercentSubtotal: number;
}

export interface StockInPolicyLedger {
  policyId: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  perUnitAmount: number;
  minQty: number | null;
  eligibleQty: number;
  earned: number;
  met: boolean;
}

export interface CombinedStockInLedger {
  policyId: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  targetQty: number;
  /** Sum of every model's eligible qty in the group. */
  combinedEligibleQty: number;
  met: boolean;
  perModel: {
    modelId: string;
    modelName: string;
    eligibleQty: number;
    perUnitAmount: number;
    earned: number;
  }[];
  totalEarned: number;
}

export interface ActivationIncentivePolicyLedger {
  policyId: string;
  periodStart: ISODate;
  periodEnd: ISODate;
  perUnitAmount: number;
  targetQty: number | null;
  /** Activations within this policy's window AND the report window. Used as the earning qty. */
  eligibleQty: number;
  earned: number;
  met: boolean;
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
  /** Phones that left via inter-ID transfer in the report period. Informational only —
   *  outbound transfers never reduce stock-in (the purchaser keeps it). */
  interIdOutQty: number;
  /** Qty used for stock-in calculation: REGULAR (direct company) purchases only. */
  effectiveStockInQty: number;
  stockInEarned: number;
  /** Per-policy breakdown; one entry per overlapping stock-in policy. */
  stockInLedger: StockInPolicyLedger[];
  /** Per-policy breakdown; one entry per overlapping activation-incentive policy. */
  activationIncentiveLedger: ActivationIncentivePolicyLedger[];

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

/** One line of the potential-loss audit trail. `amount` is 0 whenever `gateMet` is false. */
export interface CrLossComponent {
  kind: "base" | "bonus" | "activationIncentive" | "dealerIncentive";
  /** null for `base`, which has no backing policy. */
  policyId: string | null;
  gateMet: boolean;
  amount: number;
}

/**
 * What the CR-caught units would have earned had they stayed and been activated.
 *
 * An estimate, not a ledger entry: it is never deducted from any total. Stock-in is
 * deliberately absent — stock-in belongs to whoever purchased from the company and is
 * never reversed when the stock leaves.
 */
export interface CrCaughtPotentialLoss {
  totalUnits: number;
  basePercentLost: number;
  bonusPercentLost: number;
  activationIncentiveLost: number;
  dealerIncentiveLost: number;
  total: number;
  /** Every component considered, including the zeroed ones — so the UI can explain a zero. */
  components: CrLossComponent[];
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
  /** Grouped stock-in policies evaluated this period. Earnings are also folded
   *  into each model row's `stockInEarned` + totals; this is the detail view. */
  combinedStockInLedger: CombinedStockInLedger[];
  /** Estimated incentive lost to CR-caught units. Informational — not part of `totals`. */
  potentialLoss: CrCaughtPotentialLoss;

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

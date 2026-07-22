# CR-Caught Potential Incentive Loss — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fabricated `lostIncentive = priceUnitSum × basePct × 1.25` with a real, gate-aware potential incentive loss computed inside the incentive engine.

**Architecture:** CR-caught rows become an optional engine input. A new pure module `lib/incentive-engine/cr-loss.ts` sums, per caught unit, the base %, 1% target bonus, activation incentive, and dealer incentive that the unit would have earned — counting a component only when that policy's gate was actually met. `calculateIncentives` calls it after gate resolution and attaches `report.potentialLoss`. `getCrCaughtLoss` reverts to a plain SQL sum. Shared gate helpers move to `lib/incentive-engine/shared.ts` so `index.ts` and `cr-loss.ts` use one copy without a circular import.

**Tech Stack:** TypeScript, Next.js App Router v16.2.6, Drizzle ORM, Vitest, react-pdf.

**Spec:** `docs/superpowers/specs/2026-07-22-cr-caught-potential-loss-design.md`

## Global Constraints

- Stock-in is **never** part of the loss (Phase 1 locked rule: stock-in is never reversed).
- A component counts only when its policy gate was **met**. Base % has no gate and always counts.
- Gate values are **read from** the already-computed report, never re-derived with new logic.
- Threshold/marginal loss ("these units caused the gate to be missed") is **out of scope**.
- User-facing label everywhere: **"Potential incentive loss (est.)"**.
- Money rounding uses the engine's existing `round2`.
- All ISO dates are `YYYY-MM-DD` strings compared lexically.
- Gates before every commit: `npm test` and `npx tsc --noEmit` must pass.
- Commit on `master` (project convention; Vercel auto-deploys from it).

---

### Task 1: Extract shared engine helpers

Pure refactor. `cr-loss.ts` needs the same `inRange`, `round2`, and activation-incentive gate that `index.ts` uses. If `cr-loss.ts` imported them from `index.ts` while `index.ts` imports `cr-loss.ts`, that is a circular import. Moving them to a third module removes the cycle and keeps one copy of the gate logic.

**Files:**
- Create: `lib/incentive-engine/shared.ts`
- Modify: `lib/incentive-engine/index.ts:19-24` (remove local `inRange`/`round2`), `:63-95` (remove `buildActivationIncentiveLedger`), `:1-17` (imports)
- Modify: `lib/incentive-engine/types.ts:183-186` (stale doc comment)
- Test: `tests/incentive-engine.test.ts` (existing suite, unchanged — it is the regression net)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `inRange(d, start, end): boolean`, `round2(n): number`, `isActivationIncentiveGateMet(policy, modelId, allActivations): boolean`, `buildActivationIncentiveLedger(policies, modelId, periodStart, periodEnd, reportWindowActivations, allActivations): ActivationIncentivePolicyLedger[]` — all exported from `lib/incentive-engine/shared.ts`.

- [ ] **Step 1: Record the current test baseline**

Run: `npm test`
Expected: PASS, 52 tests. Write the exact number down — Task 1 must not change it.

- [ ] **Step 2: Create the shared module**

Create `lib/incentive-engine/shared.ts`:

```ts
import type {
  ActivationIncentivePolicyLedger,
  EngineActivation,
  EngineActivationIncentivePolicy,
  ISODate,
} from "./types";

/** Inclusive ISO-date interval check. ISO `YYYY-MM-DD` sorts lexically. */
export const inRange = (d: ISODate, start: ISODate, end: ISODate): boolean =>
  d >= start && d <= end;

/** Round to 2 decimals (PKR is whole-rupee in practice; this avoids float fuzz). */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * The activation-incentive gate, in one place.
 *
 * Threshold counts ALL dealer activations of this model inside the policy's own
 * window — which may extend outside the report window. A null targetQty means
 * "any activity qualifies".
 *
 * Both the earnings ledger and the CR-caught loss calculation call this, so the
 * gate can never drift between what a dealer earns and what they are told they lost.
 */
export function isActivationIncentiveGateMet(
  p: EngineActivationIncentivePolicy,
  modelId: string,
  allActivations: EngineActivation[],
): boolean {
  const thresholdQty = allActivations.filter(
    (a) => a.modelId === modelId && inRange(a.activationDate, p.periodStart, p.periodEnd)
  ).length;
  return p.targetQty == null ? thresholdQty > 0 : thresholdQty >= p.targetQty;
}

/**
 * Builds a per-policy activation-incentive ledger for one model.
 * Each overlapping policy is evaluated independently — their earned amounts accumulate (+=).
 * Threshold check uses ALL dealer activations in the policy window (not just the report slice).
 * Earning qty is the intersection of the policy window and the report window.
 */
export function buildActivationIncentiveLedger(
  policies: EngineActivationIncentivePolicy[],
  modelId: string,
  periodStart: ISODate,
  periodEnd: ISODate,
  reportWindowActivations: EngineActivation[], // already filtered to report window
  allActivations: EngineActivation[],           // full input, for threshold gate
): ActivationIncentivePolicyLedger[] {
  const overlapping = policies.filter(
    (p) => p.modelId === modelId && p.periodStart <= periodEnd && p.periodEnd >= periodStart
  );
  return overlapping.map((p) => {
    const met = isActivationIncentiveGateMet(p, modelId, allActivations);
    // Earning: activations in the intersection of policy window and report window
    const eligibleQty = reportWindowActivations.filter(
      (a) => inRange(a.activationDate, p.periodStart, p.periodEnd)
    ).length;
    return {
      policyId: p.id,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      perUnitAmount: p.perUnitAmount,
      targetQty: p.targetQty,
      eligibleQty,
      earned: met ? round2(eligibleQty * p.perUnitAmount) : 0,
      met,
    };
  });
}
```

- [ ] **Step 3: Delete the moved code from `index.ts` and import instead**

In `lib/incentive-engine/index.ts`, delete lines 19-24 (the `inRange` and `round2` consts and their comments) and lines 56-95 (the blank lines and the whole `buildActivationIncentiveLedger` function). Then add this import directly below the existing `export type * from "./types";` on line 17:

```ts
import { inRange, round2, buildActivationIncentiveLedger } from "./shared";
```

Also remove the now-unused type-only imports `EngineActivationIncentivePolicy` and `ActivationIncentivePolicyLedger` from the `import type { ... } from "./types"` block at lines 1-15 — `tsc` will flag them if missed.

- [ ] **Step 4: Fix the stale doc comment in `types.ts`**

In `lib/incentive-engine/types.ts`, replace lines 183-186:

```ts
  /** Phones that left via inter-ID transfer in the report period (subtracted from stock-in qty). */
  interIdOutQty: number;
  /** Effective qty used for stock-in calculation: max(0, regular − interIdOut). */
  effectiveStockInQty: number;
```

with:

```ts
  /** Phones that left via inter-ID transfer in the report period. Informational only —
   *  outbound transfers never reduce stock-in (the purchaser keeps it). */
  interIdOutQty: number;
  /** Qty used for stock-in calculation: REGULAR (direct company) purchases only. */
  effectiveStockInQty: number;
```

- [ ] **Step 5: Verify the refactor changed no behaviour**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; tests PASS with the **same 52** count from Step 1. Any change in pass count or a single differing assertion means the move altered behaviour — revert and redo.

- [ ] **Step 6: Commit**

```bash
git add lib/incentive-engine/shared.ts lib/incentive-engine/index.ts lib/incentive-engine/types.ts
git commit -m "refactor(incentive): extract shared gate helpers into shared.ts"
```

---

### Task 2: CR-loss types and calculator

**Files:**
- Modify: `lib/incentive-engine/types.ts` (append new interfaces; extend `EngineInput` and `IncentiveReport`)
- Create: `lib/incentive-engine/cr-loss.ts`
- Test: `tests/cr-loss.test.ts` (new file)

**Interfaces:**
- Consumes: `inRange`, `round2`, `isActivationIncentiveGateMet` from `lib/incentive-engine/shared.ts` (Task 1).
- Produces: `computeCrCaughtLoss(input: CrLossInput): CrCaughtPotentialLoss` from `lib/incentive-engine/cr-loss.ts`; types `EngineCrCaught`, `CrLossComponent`, `CrCaughtPotentialLoss`, `CrLossInput`.

- [ ] **Step 1: Add the types**

In `lib/incentive-engine/types.ts`, add after the `EngineInterIdOut` interface (currently ends line 88):

```ts
/** A cross-region-caught record: stock that left this ID and was caught. */
export interface EngineCrCaught {
  id: string;
  modelId: string;
  quantity: number;
  caughtDate: ISODate;
  dealerPriceSnapshot: number;
}
```

Add to `EngineInput` (inside the interface, after `interIdOut`):

```ts
  /** CR-caught rows in the report window. Drives `potentialLoss`. Omit to skip the calculation. */
  crCaught?: EngineCrCaught[];
```

Add at the end of the file, after `DealerIncentiveOutcome`:

```ts
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
```

Add to `IncentiveReport` (after `combinedStockInLedger`):

```ts
  /** Estimated incentive lost to CR-caught units. Informational — not part of `totals`. */
  potentialLoss: CrCaughtPotentialLoss;
```

- [ ] **Step 2: Write the failing tests**

Create `tests/cr-loss.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeCrCaughtLoss } from "@/lib/incentive-engine/cr-loss";
import type {
  EngineActivation,
  EngineActivationIncentivePolicy,
  EngineCrCaught,
  EngineDealerIncentivePolicy,
  TargetBonusOutcome,
} from "@/lib/incentive-engine/types";

const MODEL_A = "model-a";
const MODEL_B = "model-b";

const caught = (over: Partial<EngineCrCaught> = {}): EngineCrCaught => ({
  id: "cr1",
  modelId: MODEL_A,
  quantity: 5,
  caughtDate: "2026-05-10",
  dealerPriceSnapshot: 40_000,
  ...over,
});

const bonusMet: TargetBonusOutcome = {
  policyId: "tbp1", eligible: true, targetQty: 10, actualQty: 20, bonusPercent: 1,
};
const bonusMissed: TargetBonusOutcome = { ...bonusMet, eligible: false };

const aipMet: EngineActivationIncentivePolicy = {
  id: "aip1", modelId: MODEL_A, periodStart: "2026-05-01", periodEnd: "2026-05-31",
  perUnitAmount: 500, targetQty: 2,
};
const dipPolicy: EngineDealerIncentivePolicy = {
  id: "dip1", modelId: null, periodStart: "2026-05-01", periodEnd: "2026-05-31",
  targetTotalActivations: 3, perUnitAmount: 300,
};

/** Three MODEL_A activations in May — enough to meet aipMet (target 2). */
const activations: EngineActivation[] = [1, 2, 3].map((n) => ({
  id: `a${n}`, modelId: MODEL_A, activationDate: "2026-05-0" + n,
  dealerPriceSnapshot: 40_000, isCrossRegion: false,
}));

const base = (over: Partial<Parameters<typeof computeCrCaughtLoss>[0]> = {}) =>
  computeCrCaughtLoss({
    crCaught: [caught()],
    baseIncentivePercent: 4,
    targetBonus: bonusMet,
    dealerIncentives: [{ policy: dipPolicy, eligible: true }],
    activationIncentivePolicies: [aipMet],
    activations,
    ...over,
  });

describe("cr-loss: all gates met", () => {
  it("sums base, bonus, activation incentive and dealer incentive", () => {
    const r = base();
    // 5 units @ 40,000
    expect(r.totalUnits).toBe(5);
    expect(r.basePercentLost).toBe(8_000);          // 5 * 40000 * 0.04
    expect(r.bonusPercentLost).toBe(2_000);         // 5 * 40000 * 0.01
    expect(r.activationIncentiveLost).toBe(2_500);  // 5 * 500
    expect(r.dealerIncentiveLost).toBe(1_500);      // 5 * 300
    expect(r.total).toBe(14_000);
  });
});

describe("cr-loss: gating", () => {
  it("zeroes the dealer incentive when its gate was missed, leaving the rest intact", () => {
    const r = base({ dealerIncentives: [{ policy: dipPolicy, eligible: false }] });
    expect(r.dealerIncentiveLost).toBe(0);
    expect(r.basePercentLost).toBe(8_000);
    expect(r.bonusPercentLost).toBe(2_000);
    expect(r.total).toBe(12_500);
    expect(r.components).toContainEqual({
      kind: "dealerIncentive", policyId: "dip1", gateMet: false, amount: 0,
    });
  });

  it("zeroes the bonus when the target-bonus gate was missed", () => {
    const r = base({ targetBonus: bonusMissed });
    expect(r.bonusPercentLost).toBe(0);
    expect(r.total).toBe(12_000);
  });

  it("zeroes the activation incentive when too few activations met its target", () => {
    // targetQty 99 cannot be met by 3 activations
    const r = base({ activationIncentivePolicies: [{ ...aipMet, targetQty: 99 }] });
    expect(r.activationIncentiveLost).toBe(0);
    expect(r.total).toBe(11_500);
  });

  it("always counts the base % — it has no gate", () => {
    const r = base({
      targetBonus: bonusMissed,
      dealerIncentives: [{ policy: dipPolicy, eligible: false }],
      activationIncentivePolicies: [],
    });
    expect(r.basePercentLost).toBe(8_000);
    expect(r.total).toBe(8_000);
  });
});

describe("cr-loss: policy windows and model scoping", () => {
  it("ignores a policy whose window does not contain the caught date", () => {
    const r = base({
      crCaught: [caught({ caughtDate: "2026-07-15" })],
      // aipMet and dipPolicy both end 2026-05-31
    });
    expect(r.activationIncentiveLost).toBe(0);
    expect(r.dealerIncentiveLost).toBe(0);
    // base and bonus still apply — neither is window-scoped
    expect(r.total).toBe(10_000);
  });

  it("applies a model-scoped activation incentive only to its own model's caught units", () => {
    const r = base({ crCaught: [caught({ modelId: MODEL_B })] });
    expect(r.activationIncentiveLost).toBe(0); // aipMet is scoped to MODEL_A
    expect(r.basePercentLost).toBe(8_000);
  });

  it("applies a model-scoped dealer incentive only to its own model", () => {
    const scoped = { ...dipPolicy, modelId: MODEL_A };
    const r = base({
      crCaught: [caught({ modelId: MODEL_B })],
      dealerIncentives: [{ policy: scoped, eligible: true }],
    });
    expect(r.dealerIncentiveLost).toBe(0);
  });
});

describe("cr-loss: empty input", () => {
  it("returns an all-zero result for no caught rows", () => {
    const r = base({ crCaught: [] });
    expect(r).toMatchObject({
      totalUnits: 0, basePercentLost: 0, bonusPercentLost: 0,
      activationIncentiveLost: 0, dealerIncentiveLost: 0, total: 0,
    });
    expect(r.components).toEqual([]);
  });
});

describe("cr-loss: stock-in is never counted", () => {
  it("has no stock-in component and no stock-in field", () => {
    const r = base();
    expect(r.components.some((c) => String(c.kind).includes("stockIn"))).toBe(false);
    expect(r).not.toHaveProperty("stockInLost");
    // total is exactly the four known components
    expect(r.total).toBe(
      r.basePercentLost + r.bonusPercentLost + r.activationIncentiveLost + r.dealerIncentiveLost
    );
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/cr-loss.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/incentive-engine/cr-loss"`.

- [ ] **Step 4: Implement the calculator**

Create `lib/incentive-engine/cr-loss.ts`:

```ts
import { inRange, round2, isActivationIncentiveGateMet } from "./shared";
import type {
  CrCaughtPotentialLoss,
  CrLossComponent,
  EngineActivation,
  EngineActivationIncentivePolicy,
  EngineCrCaught,
  EngineDealerIncentivePolicy,
  TargetBonusOutcome,
} from "./types";

export interface CrLossInput {
  crCaught: EngineCrCaught[];
  baseIncentivePercent: number;
  /** Already-resolved outcome from the report — the gate is not re-derived here. */
  targetBonus: TargetBonusOutcome;
  /** Already-resolved dealer-incentive outcomes, paired with their policies for window/model checks. */
  dealerIncentives: { policy: EngineDealerIncentivePolicy; eligible: boolean }[];
  activationIncentivePolicies: EngineActivationIncentivePolicy[];
  /** All activations the engine loaded — used only for the activation-incentive gate. */
  activations: EngineActivation[];
}

const EMPTY: CrCaughtPotentialLoss = {
  totalUnits: 0,
  basePercentLost: 0,
  bonusPercentLost: 0,
  activationIncentiveLost: 0,
  dealerIncentiveLost: 0,
  total: 0,
  components: [],
};

/**
 * Estimates the incentive that CR-caught units would have earned had they stayed.
 *
 * Method (owner-confirmed): a sum of per-unit rates, using the policies active on each
 * unit's `caughtDate`. A component is counted only when that policy's gate was actually
 * met — money the dealer was never going to earn was not lost. The base % has no gate.
 *
 * Deliberately NOT modelled:
 *  - Stock-in. It belongs to whoever purchased from the company and never reverses.
 *  - The marginal/threshold effect (units that caused a gate to be missed). That is a
 *    counterfactual and would reintroduce the guesswork this function exists to remove.
 *
 * TODO(finding #6): once `target_bonus_policies.bonus_cap_qty` lands, the bonus component
 * must become cap-aware. Today every caught unit in a qualified period is credited the full
 * bonus %, but under a cap only the first N activated units earn it, so some caught units
 * would have fallen outside the cap and lost nothing.
 */
export function computeCrCaughtLoss(input: CrLossInput): CrCaughtPotentialLoss {
  const {
    crCaught,
    baseIncentivePercent,
    targetBonus,
    dealerIncentives,
    activationIncentivePolicies,
    activations,
  } = input;

  if (crCaught.length === 0) return { ...EMPTY, components: [] };

  const components: CrLossComponent[] = [];
  let totalUnits = 0;
  let baseLost = 0;
  let bonusLost = 0;
  let activationLost = 0;
  let dealerLost = 0;

  for (const r of crCaught) {
    totalUnits += r.quantity;
    const value = r.quantity * r.dealerPriceSnapshot;

    // --- Base %: no gate, always lost ---
    const baseAmount = round2(value * (baseIncentivePercent / 100));
    baseLost += baseAmount;
    components.push({ kind: "base", policyId: null, gateMet: true, amount: baseAmount });

    // --- Target bonus (the 1%): gated on the report's resolved eligibility ---
    const bonusAmount = targetBonus.eligible
      ? round2(value * (targetBonus.bonusPercent / 100))
      : 0;
    bonusLost += bonusAmount;
    components.push({
      kind: "bonus",
      policyId: targetBonus.policyId,
      gateMet: targetBonus.eligible,
      amount: bonusAmount,
    });

    // --- Activation incentive: per-policy, model-scoped, window must contain caughtDate ---
    for (const p of activationIncentivePolicies) {
      if (p.modelId !== r.modelId) continue;
      if (!inRange(r.caughtDate, p.periodStart, p.periodEnd)) continue;
      const gateMet = isActivationIncentiveGateMet(p, r.modelId, activations);
      const amount = gateMet ? round2(r.quantity * p.perUnitAmount) : 0;
      activationLost += amount;
      components.push({ kind: "activationIncentive", policyId: p.id, gateMet, amount });
    }

    // --- Dealer incentive: null modelId means all models ---
    for (const { policy, eligible } of dealerIncentives) {
      if (policy.modelId && policy.modelId !== r.modelId) continue;
      if (!inRange(r.caughtDate, policy.periodStart, policy.periodEnd)) continue;
      const amount = eligible ? round2(r.quantity * policy.perUnitAmount) : 0;
      dealerLost += amount;
      components.push({
        kind: "dealerIncentive",
        policyId: policy.id,
        gateMet: eligible,
        amount,
      });
    }
  }

  return {
    totalUnits,
    basePercentLost: round2(baseLost),
    bonusPercentLost: round2(bonusLost),
    activationIncentiveLost: round2(activationLost),
    dealerIncentiveLost: round2(dealerLost),
    total: round2(baseLost + bonusLost + activationLost + dealerLost),
    components,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/cr-loss.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/incentive-engine/types.ts lib/incentive-engine/cr-loss.ts tests/cr-loss.test.ts
git commit -m "feat(incentive): gated CR-caught potential loss calculator"
```

---

### Task 3: Attach `potentialLoss` to the report

**Files:**
- Modify: `lib/incentive-engine/index.ts` (destructure `crCaught`, call the calculator, add to the return)
- Test: `tests/incentive-engine.test.ts` (append a new describe block)

**Interfaces:**
- Consumes: `computeCrCaughtLoss` from `lib/incentive-engine/cr-loss.ts` (Task 2).
- Produces: `IncentiveReport.potentialLoss` — populated on every `calculateIncentives` call.

- [ ] **Step 1: Write the failing test**

Append to `tests/incentive-engine.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/incentive-engine.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'total')` on `result.potentialLoss`.

- [ ] **Step 3: Wire the calculator into `calculateIncentives`**

In `lib/incentive-engine/index.ts`:

Add to the import block near the top:

```ts
import { computeCrCaughtLoss } from "./cr-loss";
```

Add `crCaught = [],` to the destructuring of `input` (alongside `interIdOut = [],`).

Immediately before the final `return {` statement, add:

```ts
  // Estimated incentive lost to CR-caught units. Computed last, so it reads the gate
  // outcomes this report already resolved rather than deriving its own.
  const potentialLoss = computeCrCaughtLoss({
    crCaught: crCaught.filter((c) => inRange(c.caughtDate, periodStart, periodEnd)),
    baseIncentivePercent,
    targetBonus,
    dealerIncentives: dipStatuses.map((ds) => ({ policy: ds.policy, eligible: ds.eligible })),
    activationIncentivePolicies,
    activations,
  });
```

Add `potentialLoss,` to the returned object, directly after `combinedStockInLedger,`.

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; PASS, 66 tests (52 existing + 10 from Task 2 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add lib/incentive-engine/index.ts tests/incentive-engine.test.ts
git commit -m "feat(incentive): expose potentialLoss on the incentive report"
```

---

### Task 4: Load CR-caught rows; strip the formula from the query layer

`buildMonthlyEarnings` is deliberately left alone: its callers read only `grandTotal` and `totalActivations`, so loading CR-caught rows there would add a query to a hot 6-month path for a value nobody reads. `potentialLoss` stays zeroed in that path.

**Files:**
- Modify: `lib/incentive-engine/loader.ts:120-156` (add the fetch), `:158-204` (add to `EngineInput`)
- Modify: `lib/db/queries/cr-caught.ts:56-85` (`getCrCaughtLoss`)

**Interfaces:**
- Consumes: `EngineInput.crCaught` (Task 2), `IncentiveReport.potentialLoss` (Task 3).
- Produces: `getCrCaughtLoss(tenantId, dealerId, from, to): Promise<{ totalUnits, priceUnitSum, totalFines }>` — the `basePct` parameter and the `lostIncentive` field are both gone.

- [ ] **Step 1: Load CR-caught rows in `buildIncentiveReport`**

In `lib/incentive-engine/loader.ts`, extend the `Promise.all` at line 120 to a fourth query. Change the destructuring line to:

```ts
  const [activations, purchases, interIdOut, crCaught] = await Promise.all([
```

and add this as the fourth array element, after the `interIdTransfers` query:

```ts
    db
      .select()
      .from(schema.crCaught)
      .where(
        and(
          eq(schema.crCaught.tenantId, dataTenantId),
          eq(schema.crCaught.dealerId, dealerId),
          gte(schema.crCaught.caughtDate, periodStart),
          lte(schema.crCaught.caughtDate, periodEnd),
          ne(schema.crCaught.status, "pending_owner_approval")
        ) as SQL
      ),
```

Note the window is `periodStart`/`periodEnd` (the report window), not `minStart`/`maxEnd` — the loss is reported for the period on screen, not for every policy window.

Then add to the `engineInput` object, after `interIdOut`:

```ts
    crCaught: crCaught.map((c) => ({
      id: c.id,
      modelId: c.modelId,
      quantity: c.quantity,
      caughtDate: c.caughtDate,
      dealerPriceSnapshot: c.dealerPriceSnapshot,
    })),
```

- [ ] **Step 2: Reduce `getCrCaughtLoss` to a plain sum**

In `lib/db/queries/cr-caught.ts`, replace the whole function at lines 56-85 with:

```ts
/**
 * Raw CR-caught totals for a period. Deliberately contains no incentive math —
 * the potential incentive loss is computed by the engine (`report.potentialLoss`),
 * which is the only place that knows which policy gates were actually met.
 */
export async function getCrCaughtLoss(
  tenantId: string,
  dealerId: string,
  from: string,
  to: string
): Promise<{ totalUnits: number; priceUnitSum: number; totalFines: number }> {
  const rows = await db
    .select({ qty: schema.crCaught.quantity, price: schema.crCaught.dealerPriceSnapshot, fine: schema.crCaught.fineAmount })
    .from(schema.crCaught)
    .where(
      and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        gte(schema.crCaught.caughtDate, from),
        lte(schema.crCaught.caughtDate, to),
        ne(schema.crCaught.status, "pending_owner_approval")
      )
    );
  let totalUnits = 0;
  let priceUnitSum = 0;
  let totalFines = 0;
  for (const r of rows) {
    totalUnits += r.qty;
    priceUnitSum += r.qty * r.price;
    totalFines += r.fine ?? 0;
  }
  return { totalUnits, priceUnitSum: Math.round(priceUnitSum), totalFines: Math.round(totalFines) };
}
```

`ne` is already imported on line 3 — no import change needed.

- [ ] **Step 3: Verify types break exactly where expected**

Run: `npx tsc --noEmit`
Expected: FAIL, with errors **only** in the consumer files handled by Tasks 5-7 — passing 5 arguments to `getCrCaughtLoss`, and reading the removed `lostIncentive`. Confirm no error appears in `lib/incentive-engine/**`. This failing list is the worklist for the next three tasks; save it.

- [ ] **Step 4: Commit (compiles only after Task 7 — commit the pair with `--no-verify` disabled)**

Do not commit yet. Tasks 4-7 form one compiling unit; commit at the end of Task 7.

---

### Task 5: Update the server call sites

Every one of these files already calls `buildIncentiveReport` (verified), so `report.potentialLoss.total` is in scope at each `getCrCaughtLoss` call.

**Files (exact call sites from `git grep`):**
- Modify: `app/team/(protected)/dashboard/page.tsx:65` (call), `:144` (`value={crLoss.lostIncentive}`)
- Modify: `app/(app)/reports/page.tsx:51` (call)
- Modify: `app/api/report/route.ts:56, 81, 98, 124, 151` (five calls)
- Modify: `app/(app)/dashboard/actions.ts:67` (return type), `:84` (call)
- Modify: `app/(app)/dashboard/page.tsx:60` (call)
- Modify: `app/dealer/(portal)/dashboard/page.tsx:106` (call), `:189-190` (`lostIncentive` / `riskExposure`)

**Interfaces:**
- Consumes: `getCrCaughtLoss(tenantId, dealerId, from, to)` (Task 4), `report.potentialLoss.total` (Task 3).
- Produces: a `potentialLoss: number` field on every `crLoss`-shaped prop passed to a client component, replacing `lostIncentive`.

- [ ] **Step 1: Read each file before editing it**

Use the Read tool on each of the seven files. Do not edit from the line numbers alone — they are anchors from a `git grep` snapshot, and earlier edits in the same file shift later lines.

- [ ] **Step 2: Apply the mechanical transformation**

Two changes per file, both mechanical:

1. **Drop the fifth argument.** `getCrCaughtLoss(X, Y, from, to, constants.basePercent)` → `getCrCaughtLoss(X, Y, from, to)`. Where `constants` becomes unused afterwards, remove the now-dead `getConstants()` call too; where it is still used for other things, leave it.
2. **Source the loss from the report.** Wherever a `crLoss`-shaped object is passed to a client component or read for display, replace the `lostIncentive` field with `potentialLoss`, fed from the report already built in that file. For example, in `app/dealer/(portal)/dashboard/page.tsx:189-190`:

```ts
// before
  const lostIncentive = crLoss?.lostIncentive ?? 0;
  const riskExposure = lostIncentive + crFines;

// after
  const potentialLoss = report.potentialLoss.total;
  const riskExposure = potentialLoss + crFines;
```

Use the local variable name that file already uses for the report (`report`, `incentiveReport`, etc.) — read it from the file, do not assume.

In `app/(app)/dashboard/actions.ts:67`, update the declared return type:

```ts
// before
  crLoss: { lostIncentive: number; totalUnits: number; totalFines: number; priceUnitSum: number };
// after
  crLoss: { potentialLoss: number; totalUnits: number; totalFines: number; priceUnitSum: number };
```

and build it as `crLoss: { ...crLoss, potentialLoss: report.potentialLoss.total }`.

- [ ] **Step 3: Check progress**

Run: `npx tsc --noEmit`
Expected: still FAIL, but every remaining error is now in a **client component or PDF** file (Tasks 6-7). No error should remain in `app/**/page.tsx`, `app/**/actions.ts`, or `app/api/**`.

---

### Task 6: Update the client display surfaces

**Files (exact anchors from `git grep`):**
- Modify: `app/(app)/dashboard/dashboard-analytics.tsx:79` (prop type), `:589`, `:1194`, `:1228`, `:1266`, `:1325`
- Modify: `app/(app)/reports/reports-client.tsx:64` (prop type), `:477`, `:731`
- Modify: `components/feature/reports-premium.tsx:24` (prop type), `:559`
- Modify: `components/feature/dashboard-minimal.tsx:30` (prop type)
- Modify: `app/dealer/(portal)/dashboard/dealer-dashboard-client.tsx:87` (prop type)

**Interfaces:**
- Consumes: the `potentialLoss` prop field produced by Task 5.
- Produces: no new interfaces — display only.

- [ ] **Step 1: Read each file before editing it**

Five files. Read each one; the anchors above shift as you edit.

- [ ] **Step 2: Rename the field and fix every label**

1. In each prop type, `lostIncentive: number` → `potentialLoss: number`.
2. Every read `crLoss.lostIncentive` / `crCaughtLoss.lostIncentive` → `.potentialLoss`.
3. Every user-visible label for this number becomes exactly **"Potential incentive loss (est.)"**. Existing wordings to replace include `"CR Loss"` (`dashboard-analytics.tsx:1194`), `"CR Caught Loss"` (`:1228`), `"est. loss"` (`:1266`), and `` `est. lost ${formatPKR(...)}` `` (`reports-client.tsx:477`). Where the space is tight (a compact KPI chip such as `:1194`), use **"Potential loss (est.)"** — the shorter form is allowed only there.

- [ ] **Step 3: Check progress**

Run: `npx tsc --noEmit`
Expected: still FAIL, but only in `lib/export/report-pdf.tsx` and `lib/export/report-pdf-detailed.tsx` (Task 7).

---

### Task 7: Update the PDFs and fix the stale stock-in copy

`report-pdf-detailed.tsx:723` currently tells dealers the loss exists "because these phones do not earn stock-in rewards". Phase 1 made that false — stock-in is never reversed. The sentence must be replaced, not just re-worded around the new number.

**Files:**
- Modify: `lib/export/report-pdf.tsx:336`, `:539`, `:640`, `:786`, `:1159`
- Modify: `lib/export/report-pdf-detailed.tsx:479`, `:588`, `:721`, `:723`

**Interfaces:**
- Consumes: the `potentialLoss` field (Tasks 5-6).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Read both files before editing**

- [ ] **Step 2: Rename the field in all five type declarations**

`crCaughtLoss?: { totalUnits: number; lostIncentive: number; totalFines: number }` → `crCaughtLoss?: { totalUnits: number; potentialLoss: number; totalFines: number }` at `report-pdf.tsx:336`, `:640`, `:1159` and `report-pdf-detailed.tsx:588`. At `report-pdf-detailed.tsx:479` the same rename applies to the `loss` parameter of `FinesSection`.

- [ ] **Step 3: Update the reads and labels**

`report-pdf.tsx:539` and `:786` read `crCaughtLoss.lostIncentive` → `.potentialLoss`. At `:786` the label `"· Est. Lost Incentive: "` becomes `"· Potential incentive loss (est.): "`.

- [ ] **Step 4: Replace the false stock-in sentence**

In `lib/export/report-pdf-detailed.tsx`, the guard at `:721` becomes `{crCaughtLoss!.potentialLoss > 0 && (` and the sentence at `:723` becomes:

```tsx
                Note: on top of the fines, about {fmtPKR(crCaughtLoss!.potentialLoss)} of incentive
                was likely lost because these phones were not activated on your ID. Stock-in is not
                included — it stays with whoever purchased from the company.
```

- [ ] **Step 5: Verify the whole thing compiles and passes**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; PASS, 66 tests.

- [ ] **Step 6: Confirm the old formula is gone**

Run: `git grep -n "lostIncentive\|\* 1\.25" -- ':!*.md' ':!.claude' ':!.agents'`
Expected: **no output**. Any hit is a missed surface.

- [ ] **Step 7: Commit Tasks 4-7 as one compiling change**

```bash
git add lib/incentive-engine/loader.ts lib/db/queries/cr-caught.ts app lib/export components
git commit -m "feat(incentive): real CR-caught potential loss across all surfaces

Replaces the fabricated priceUnitSum x basePct x 1.25 with the engine's
gate-aware potentialLoss. getCrCaughtLoss is now a plain sum and also
excludes pending_owner_approval rows, matching the other four CR queries."
```

---

### Task 8: Verification

**Files:** none modified.

- [ ] **Step 1: Full gates**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; PASS, 66 tests.

- [ ] **Step 2: Targeted lint on the changed files**

Run: `npx eslint lib/incentive-engine lib/db/queries/cr-caught.ts lib/export/report-pdf.tsx lib/export/report-pdf-detailed.tsx`
Expected: no new errors. The repository has a known-dirty full-lint baseline (56 errors / 358 warnings, mostly in `.agents`/`.claude` skill assets) — judge only the files listed here.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Report the numbers back to the owner**

Before deploying, state plainly for one real dealer with CR-caught activity in the current period: the old displayed loss, the new displayed loss, and the component split (base / bonus / activation / dealer). The number will usually **drop** — both because `× 1.25` is gone and because pending rows are now excluded. The owner needs to see that difference and confirm it looks right, rather than discovering it on the live dashboard.

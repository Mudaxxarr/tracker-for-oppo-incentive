# CR-Caught Potential Incentive Loss — Design / Spec

**Date:** 2026-07-22
**Status:** Approved by owner
**Supersedes:** Phase 7 of `2026-07-21-incentive-accuracy-audit-design.md` (Finding #10)

## Why this changes the earlier plan

Audit Finding #10 originally said: delete the fabricated `lostIncentive` number entirely and
keep only the real `totalFines`. The owner raised a correct objection — when a set leaves the
ID via cross-region, the incentive that set would have earned is a **genuine** loss and must
stay visible. So #10 becomes a **replacement**, not a deletion.

The current formula is wrong for two independent reasons:

```ts
// lib/db/queries/cr-caught.ts:83
const lostIncentive = Math.round(priceUnitSum * (basePct / 100) * 1.25);
```

1. The `× 1.25` multiplier is fabricated — no such company formula exists. It was a hand-wave
   standing in for "the other components".
2. It only ever included the base %. Activation incentive, dealer incentive, and the 1% target
   bonus were never in it. Depending on the period's policies, `× 1.25` can under-state the
   loss badly or over-state it entirely.

## Owner-confirmed rules

- **Method:** sum of per-unit rates. For each caught unit: base % + 1% bonus + activation
  incentive + dealer incentive, resolved from the policies active on that unit's `caughtDate`.
  The threshold/marginal effect (units causing a gate to be missed) is **out of scope** —
  it is a counterfactual and would reintroduce guesswork.
- **Gates:** a component counts only if that policy's gate was actually **met** in the period.
  Money the dealer was never going to earn was not lost. Base % has no gate, so it always counts.
- **Stock-in is never part of the loss.** Per the Phase 1 locked rule, stock-in belongs to
  whoever purchased from the company and is never reversed when stock leaves.
- **Pending CR rows do not count.** `getCrCaughtLoss` is the only one of the five CR-caught
  queries missing the `ne(status, "pending_owner_approval")` filter that the other four apply
  (lines 96, 112, 129, 165), so unapproved rows currently inflate both the loss and `totalFines`.
  This contradicts the locked decision that an SO's CR transfer does not move stock until the
  owner approves it. The filter is added, correcting **both** numbers. Dealers holding pending
  CR rows will see their displayed loss and fines drop — that is the correction, not a regression.

## Architecture

All six call sites of `getCrCaughtLoss` already run `loadIncentiveInput` + `buildIncentiveReport`,
so the policies and the resolved gate outcomes are already in memory. The calculation therefore
belongs in the engine, where `targetBonus.eligible`, `dealerIncentives[].eligible`, and
`activationIncentiveLedger[].met` already exist. Computing it anywhere else would mean a second
copy of the gate logic — the same class of drift that produced `× 1.25`.

### Data shapes — `lib/incentive-engine/types.ts`

```ts
export interface EngineCrCaught {
  id: string;
  modelId: string;
  quantity: number;
  caughtDate: ISODate;
  dealerPriceSnapshot: number;
}

export interface CrLossComponent {
  kind: "base" | "bonus" | "activationIncentive" | "dealerIncentive";
  policyId: string | null;   // base has no backing policy
  gateMet: boolean;
  amount: number;            // 0 when gateMet is false
}

export interface CrCaughtPotentialLoss {
  totalUnits: number;
  basePercentLost: number;
  bonusPercentLost: number;
  activationIncentiveLost: number;
  dealerIncentiveLost: number;
  total: number;
  components: CrLossComponent[];
}
```

- `EngineInput.crCaught?: EngineCrCaught[]` — optional, so existing callers and tests keep working.
- `IncentiveReport.potentialLoss: CrCaughtPotentialLoss` — always present; zeroed when there is
  no CR-caught activity.

`components[]` is the audit trail. When a dealer asks why the dealer-incentive loss shows zero,
the answer is in the data (`{ kind: "dealerIncentive", gateMet: false, amount: 0 }`) rather than
inferred by the UI.

### Calculation — `lib/incentive-engine/cr-loss.ts` (new file)

A new module rather than more code in `index.ts`, which is already 463 lines.
`buildIncentiveReport` calls it **after** the gate outcomes are computed and attaches the result.

For each CR-caught row `r`, using policies whose window contains `r.caughtDate`
(`periodStart <= caughtDate <= periodEnd`):

| Component | Gate | Amount |
|---|---|---|
| Base % | none | `r.quantity × r.dealerPriceSnapshot × baseIncentivePercent / 100` |
| 1% bonus | `targetBonus.eligible` | `r.quantity × r.dealerPriceSnapshot × bonusPercent / 100` |
| Activation incentive | that policy's ledger `met` | `r.quantity × perUnitAmount` |
| Dealer incentive | that outcome's `eligible` | `r.quantity × perUnitAmount` |
| Stock-in | — | never counted |

Model scoping: activation-incentive policies match on `modelId === r.modelId`. Dealer-incentive
policies match when `modelId == null` (all models) or `modelId === r.modelId`.

Gate values are read from the already-computed report — never re-derived.

### Wiring

- **Loader** (`lib/incentive-engine/loader.ts`): fetch the report window's CR-caught rows into
  `EngineInput.crCaught`. The loader does not currently load them at all.
- **`getCrCaughtLoss`** (`lib/db/queries/cr-caught.ts`): drop the `lostIncentive` field and the
  now-unused `basePct` parameter. It returns `{ totalUnits, priceUnitSum, totalFines }` — a plain
  SQL sum with no financial formula.
- **Consumers** (11 files): read `report.potentialLoss.total` instead of `crLoss.lostIncentive`.
  Label everywhere: **"Potential incentive loss (est.)"**.
- **`lib/export/report-pdf-detailed.tsx:723`**: the copy "because these phones do not earn
  stock-in rewards" is wrong after Phase 1 and is replaced.
- **`app/dealer/(portal)/dashboard/page.tsx:190`**: `riskExposure` uses the new number.
- **`lib/incentive-engine/types.ts:185`**: the `effectiveStockInQty` doc comment still describes
  `max(0, regular − interIdOut)`, which Phase 1 removed (`index.ts:386` now assigns
  `totalSipRegularQty`). Corrected as part of this change.

## Testing

Engine changes are test-first, added to the existing 52-test suite.

1. All gates met → the four components sum to the expected total.
2. Dealer-incentive gate missed → that component is 0, the others are unaffected.
3. Bonus gate missed → bonus component is 0.
4. `caughtDate` outside a policy's window → that policy does not contribute.
5. A model-scoped activation-incentive policy applies only to caught units of its own model.
6. `crCaught` empty or undefined → `total === 0`, no crash.
7. Stock-in never appears in the loss, including when a stock-in policy is met that period.

Gates: `npm test` and `npx tsc --noEmit` must pass before commit.

## Known limitation

When Finding #6 (target-bonus activation cap) lands, the 1% loss will need to become cap-aware:
today every caught unit in a qualified period is credited the full 1%, but under a cap only the
first N activated units earn it, so some caught units would not have been within the cap. A TODO
in `cr-loss.ts` records this, and #6's implementation must revisit it.

## Out of scope

- Threshold/marginal loss (the "these units caused the gate to be missed" case).
- Any change to how CR-caught rows are recorded, approved, or applied to physical stock.
- The remaining audit findings (#4, #6, #7, #8, Phase 8 hidden ID).

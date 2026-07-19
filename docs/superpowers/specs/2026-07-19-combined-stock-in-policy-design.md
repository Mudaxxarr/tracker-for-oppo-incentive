# Combined Stock-In Policy — Design

**Date:** 2026-07-19
**Status:** Approved (owner)

## Goal

Let the owner define a **stock-in policy whose target quantity is counted across a
group of models combined**, while the payout rate stays per-model. Example:
group = {A6k 4/128 @ 500, A6k 8/128 @ 900}, combined target = 20. If the dealer
stocks in a combined 20+ units of the group in the period, each model is paid on
its full quantity at its own rate.

The existing **per-model** stock-in policy is unchanged and untouched.

## Non-collision principle (owner-confirmed invariant)

Two stock-in policies for the same model never overlap in time — a model's next
stock-in policy can only start after the previous one's end date. Therefore a
model is never simultaneously in a per-model policy and a combined policy for the
same window, so double-pay cannot occur in practice. We additionally enforce this
with a light guard at creation (below), so it can never happen even by mistake.

## Money rule (owner-confirmed)

The target is only a **trigger**; once met, payout is on the **full** eligible
quantity (including quantity beyond the target) — identical to how the current
per-model stock-in already behaves.

```
For a combined policy P over models M with per-model rate r(m), period [start,end], targetQty T:
  elig(m)      = REGULAR purchase qty of m in [start,end]  −  inter-ID-out qty of m in [start,end]   (min 0)
  combinedQty  = Σ elig(m) for m in M
  if combinedQty >= T:
      earned(m) = elig(m) * r(m)      for each m in M   (0 if elig(m)==0)
  else:
      earned(m) = 0
```

`elig(m)` uses the exact same definition as the existing per-model stock-in
(`eligibleQty = regularQty − interIdOutQty`).

## Data model (new, additive — existing `stock_in_policies` untouched)

- `combined_stock_in_policies`: `id`, `tenantId`, `dealerId` (→ dealerIds, cascade),
  `periodStart`, `periodEnd`, `targetQty` (int), `createdAt`.
- `combined_stock_in_policy_models`: `id`, `policyId` (→ combined_stock_in_policies, cascade),
  `modelId` (→ models, restrict), `perUnitAmount` (real). Unique (policyId, modelId).

Supports N models per policy (≥1; UI encourages ≥2).

## Incentive-engine integration

Add a **separate pass** in `lib/incentive-engine/index.ts` (calculations stay
centralized — no duplication in UI). It runs alongside the existing per-model
pass and merges results **into the same buckets** so all downstream totals stay
correct with no other change:

1. Load combined policies + their model rows in `loader.ts`
   (new `EngineCombinedStockInPolicy` type; also fold their period into the
   sub-period boundary logic so cached windows cover them).
2. Before/while building model rows, evaluate each overlapping combined policy →
   `combinedEarnedByModel: Map<modelId, number>` + a `combinedStockInLedger`
   (policy id, target, combinedQty, met, per-model breakdown) for transparency.
3. Add `combinedEarnedByModel.get(modelId)` into that model's `stockInEarned`
   (so per-model row totals, `total`, `totalsStockIn`, and `grandTotal` all
   include it automatically). Attach the ledger to the report for detail.

Because combined earnings flow into the existing `stockInEarned`/`grandTotal`,
**dashboards, reports, and PDFs that already read `stockInEarned` include it with
no further change**. Verify each surface reads the bucket (not a re-derivation).

## Safety guard (creation-time)

When creating a combined policy, for every model in it, reject if that model has
any stock-in policy (per-model OR combined) whose period overlaps the new one.
Enforces the owner's existing practice; guarantees no double-count.

## UI

- Owner policies page (`app/(app)/policies`): the stock-in section gets a
  **separate button** ("Combined Stock-In Policy") that opens a form: period,
  target qty, and a repeatable (model, rate) row list. Existing per-model
  stock-in form stays as-is. List existing combined policies with delete.
- Dealer policies page: read-only display of combined policies (mirrors how
  dealers view existing stock-in policies).

## Testing

Unit tests in the incentive-engine suite:
- combined target met → both models paid on full qty at their rates
- not met → 0 for all
- extra qty beyond target → full qty paid
- inter-ID out reduces combined eligible qty
- single-model-heavy group (e.g. 20 of one, 0 of other) still triggers
- combined pass does not alter per-model stock-in results (isolation)

## Out of scope

- No change to per-model stock-in, rebates, activation/dealer incentives.
- No per-model minimum within a group (only the combined target matters).

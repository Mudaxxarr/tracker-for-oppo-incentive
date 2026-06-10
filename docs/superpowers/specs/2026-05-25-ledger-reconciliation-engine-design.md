# Ledger Reconciliation Engine (Anti-Double-Dip) — Design Spec

**Date:** 2026-05-25  
**Status:** Approved

---

## Problem

When a model's dealer price drops, `createRebatesForPriceDrop` creates rebate records for all dealer IDs that have stock. Two bugs exist:

1. **Wrong stock snapshot**: The function calls `getStockForModel` (current-time), not `getStockForModelAsOf(rebateDate)`. Even the initial rebate calculation uses today's stock, not the stock at the moment of the price drop.

2. **No activation hook**: If a user later backdates an activation to a date before a price drop, the rebate records are never re-evaluated. A unit that was already sold before the drop remains incorrectly counted as "in stock" at drop time.

**Concrete scenario:**
- May 4: 1 unit sold (activation not yet posted)
- May 5: Price drops 1000 PKR → system sees 2 units in stock → creates 2000 PKR rebate
- Later: User posts the May 4 activation
- **Bug**: Rebate still shows 2000 PKR — but correct value is 1000 PKR (only 1 unit was in stock on May 5)

---

## Approach: Dealer-Scoped Hook (Approach B)

Surgical re-evaluation scoped to the affected dealer only. Two changes:

1. Fix `createRebatesForPriceDrop` to use point-in-time stock.
2. Add `reEvaluateRebatesForDealer` — a dealer-scoped recalculation function called after every activation mutation.

---

## Section 1: Root Fix — Point-in-Time Stock

In `lib/db/queries/rebates.ts`, `createRebatesForPriceDrop`:

```
- const eligibleQty = await getStockForModel(input.tenantId, dealerId, input.modelId);
+ const eligibleQty = await getStockForModelAsOf(input.tenantId, dealerId, input.modelId, input.rebateDate);
```

This ensures all rebate records (initial creation and re-evaluations) use the stock count as it existed on the price drop date.

---

## Section 2: New Function `reEvaluateRebatesForDealer`

**Location:** `lib/db/queries/rebates.ts`

**Signature:**
```ts
reEvaluateRebatesForDealer(
  tenantId: string,
  dealerId: string,
  modelId: string,
  fromDate: string   // YYYY-MM-DD
): Promise<void>
```

**Algorithm:**
1. Fetch full price history for the model (all entries, ASC by `effectiveFrom`) — full list needed to resolve the "preceding entry" for entries near `fromDate`.
2. Find the first entry where `effectiveFrom >= fromDate`.
3. From that index forward, for each entry `curr` with preceding entry `prev`:
   - If `prev.dealerPrice > curr.dealerPrice` (price drop):
     - Compute `eligibleQty = getStockForModelAsOf(tenantId, dealerId, modelId, curr.effectiveFrom)`
     - Delete existing rebates for `(tenantId, priceHistoryId=curr.id, dealerId)`
     - If `eligibleQty > 0`: insert new rebate row
   - Else (flat or increase):
     - Delete any rebate for `(tenantId, priceHistoryId=curr.id, dealerId)`

**Scope:** Only touches rebate rows for the specified `dealerId`. Other dealers are unaffected.

---

## Section 3: Activation Hooks

After every activation mutation, call `reEvaluateRebatesForDealer` with the earliest affected date.

| Action | Trigger Date | Notes |
|--------|-------------|-------|
| Create single | `activationDate` | |
| Create bulk by date | `activationDate` (shared) | Single call after all inserts |
| Update | `min(oldDate, newDate)` | Both directions affect rebates |
| Delete single | `activationDate` (fetched before delete) | |
| Bulk delete | `min(activationDate)` across batch | Fetch all records before deleting |

**Files modified:**
- `app/(app)/activations/actions.ts` — owner portal (5 actions)
- `app/dealer/(portal)/activations/actions.ts` — dealer portal (4 actions)

**Error handling:** Rebate recalc runs after the activation write commits. If recalc throws, the activation still succeeds — the error is swallowed silently (rebates are accounting metadata; they must never block a dealer from logging a sale). A future improvement could log recalc failures to `owner_alerts`, but is out of scope here.

---

## Section 4: Edge Cases

| Case | Behavior |
|------|----------|
| No price drops after `fromDate` | Function returns immediately — zero DB writes |
| Activation deleted (unit returns to stock) | Recalc runs from deleted activation's date; rebate increases if unit was back in stock at a price drop |
| Bulk delete | One recalc pass from the earliest activation date in the batch |
| Model with no price history | Full list is empty — function returns immediately |

---

## Files Changed

| File | Change |
|------|--------|
| `lib/db/queries/rebates.ts` | Fix `getStockForModel` → `getStockForModelAsOf`; add `reEvaluateRebatesForDealer` |
| `app/(app)/activations/actions.ts` | Hook into 5 actions |
| `app/dealer/(portal)/activations/actions.ts` | Hook into 4 actions |

**No schema changes. No migrations. No new tables.**

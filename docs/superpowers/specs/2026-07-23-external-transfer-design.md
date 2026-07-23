# External Transfer — Design / Spec

**Date:** 2026-07-23
**Status:** Approved by owner (requirements locked through Q&A)

## What this is

Dealers in different cities do each other favours: they park their stock in another dealer's
possession, or pull stock from one, to cover shortfalls. The counterpart is an **external**
dealer — NOT in this system, no login, no ID, no incentive of theirs to compute. We only record
**our own** stock moving in or out, with a text note of who/where.

Named **External Transfer**, two directions:
- **Transfer In** — stock enters one of our IDs from an external dealer.
- **Transfer Out** — our stock leaves one of our IDs to an external dealer.

## Locked decisions

- Counterpart is free text only: **dealer name + city + optional note**. No FK, no tenant, no
  cross-system anything.
- The external dealer's percentage/incentive is **never stored or shown**. Owner: "us dealer ka
  kuch nahi banana."
- **Available by default to every dealer**, whether they hold 1 ID or 2. (Unlike inter-ID
  transfer, which only appears at 2+ IDs — that gate does not apply here.)
- **Permission: dealer `admin` role only.** Dealer `exec` (and any team member) cannot create,
  edit or delete an External Transfer. Enforced on the server action, mirrored in the UI.
- Incentive treatment — this is purely stock movement, with exactly one correctness guard:
  - **Transfer In is NOT a company purchase**, so it earns **no stock-in** and does **not**
    count toward the target-bonus gate. It IS physical stock, so those units can be activated
    and sold; activations then earn base/activation/dealer/1% per the existing "earned where
    activated" rule — automatically, because the engine already keys those off activations.
  - **Transfer Out never reverses stock-in** (locked rule: the purchaser keeps stock-in). It
    only reduces physical stock on hand.

## Architecture

### Why a dedicated table, and NOT the engine

External transfers touch **physical stock only**; they must not touch incentive math. Modelling
Transfer In as a `purchases` row would drag it through the incentive engine and every purchase
report, risking exactly the kind of mis-credit the audit just fixed. Instead:

- New table **`external_transfers`**: `id, tenantId, dealerId, modelId, quantity, direction
  ('IN' | 'OUT'), transferDate, counterpartName, counterpartCity, note, createdAt`.
- The **incentive engine and loader are NOT touched.** Because a Transfer In is not a `purchase`,
  the engine never sees it → it can never earn stock-in or move the target gate. Nothing to add,
  nothing to exclude. This is the safest possible integration for financial accuracy.
- Only the **physical stock computation** changes: add `SUM(IN)` and subtract `SUM(OUT)`.

### The stock formula, updated

Current (CLAUDE.md):
```
Stock = SUM(purchases.quantity)
      - COUNT(activations)
      - SUM(interIdTransfers out, status != REJECTED)
      - SUM(crCaught, status != pending_owner_approval)
```
Becomes:
```
Stock = SUM(purchases.quantity)
      + SUM(external_transfers where direction = IN)
      - SUM(external_transfers where direction = OUT)
      - COUNT(activations)
      - SUM(interIdTransfers out, status != REJECTED)
      - SUM(crCaught, status != pending_owner_approval)
```

Every site that computes stock must add the two external terms. Known sites (from `git grep`):
`lib/db/queries/purchases.ts` (listStockForDealer, getStockForModel, getStockForModelAsOf,
stock timeline), `lib/db/queries/inventory.ts`, `app/dealer/(portal)/inventory/actions.ts`,
`app/(app)/inventory/actions.ts`, `app/dealer/(portal)/pos/actions.ts`,
`app/(app)/low-stock/page.tsx`. To avoid drift, a single query helper
`externalTransferStockDelta(tenantId, dealerId[, modelId][, asOf])` returns the net ±qty and is
called from each site, rather than re-writing the SUM in seven places.

### Guards

- **Transfer Out** cannot exceed stock on hand as of its date — reuse the existing
  `getStockForModelAsOf` guard pattern used by inter-ID transfers, inside the same transaction.
- Editing/deleting an External Transfer re-checks the guard and is admin-only.

### UI

Dealer portal, on the **Inventory** page (where inter-ID transfer already lives), a new
"External Transfer" card: direction toggle (In/Out), model, quantity, date, counterpart name,
city, note. A list of recent external transfers with edit/delete. The whole card renders only
for `role === "admin"`; an exec sees an explanatory disabled state or nothing.

Owner portal: read-only visibility of a dealer's external transfers on the owner inventory view
(so the owner can see the movement), no new owner controls required for v1.

## Testing

- Stock math is financial → **test-first**. Unit-test `externalTransferStockDelta` and an
  integration-style check that a Transfer In raises stock and a Transfer Out lowers it, that
  neither changes any incentive total, and that Transfer Out is blocked past available stock.
- Engine suite must remain **86/86 unchanged** — proof the engine is untouched.
- `npm test`, `npx tsc --noEmit`, `npm run build` all clean before merge.

## Rollout

- Hand-written migration script (`scripts/migrate-add-external-transfers.mjs`), project pattern.
- Its own branch → verify → show the owner a real before/after stock number → merge to master.

## Out of scope

- Any incentive for, or percentage of, the external dealer.
- Owner-side creation of external transfers (v1 is dealer-admin-driven; owner sees them read-only).
- Turning a Transfer In into a company purchase (deliberately never a purchase).

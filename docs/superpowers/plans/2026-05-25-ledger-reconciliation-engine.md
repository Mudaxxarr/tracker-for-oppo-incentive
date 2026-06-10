# Ledger Reconciliation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix rebate calculations to use point-in-time stock and automatically re-evaluate rebates whenever an activation is created, edited, or deleted.

**Architecture:** Two-part fix — (1) change `createRebatesForPriceDrop` to use `getStockForModelAsOf(rebateDate)` instead of current-time stock, and (2) add `reEvaluateRebatesForDealer` (dealer-scoped recalc function) called from all activation mutation actions in both owner and dealer portals.

**Tech Stack:** Next.js App Router · Drizzle ORM · PostgreSQL · TypeScript

---

## File Map

| File | Change |
|------|--------|
| `lib/db/queries/rebates.ts` | Fix import + `createRebatesForPriceDrop` call; add `reEvaluateRebatesForDealer` |
| `app/(app)/activations/actions.ts` | Import `reEvaluateRebatesForDealer`; hook into 5 actions |
| `app/dealer/(portal)/activations/actions.ts` | Import `reEvaluateRebatesForDealer` + `getActivationById`; hook into 4 actions |

---

## Task 1: Fix Point-in-Time Stock in `createRebatesForPriceDrop`

**Files:**
- Modify: `lib/db/queries/rebates.ts`

Currently `createRebatesForPriceDrop` calls `getStockForModel` (returns today's stock count). It must call `getStockForModelAsOf(rebateDate)` instead so rebates reflect stock at the moment of the price drop.

- [ ] **Step 1: Update the import on line 6**

Change:
```ts
import { getStockForModel } from "./purchases";
```
To:
```ts
import { getStockForModelAsOf } from "./purchases";
```

- [ ] **Step 2: Fix the stock call inside `createRebatesForPriceDrop` (around line 149)**

Change:
```ts
const eligibleQty = await getStockForModel(input.tenantId, dealerId, input.modelId);
```
To:
```ts
const eligibleQty = await getStockForModelAsOf(input.tenantId, dealerId, input.modelId, input.rebateDate);
```

- [ ] **Step 3: TypeScript check**

```powershell
cd "C:\Users\Admin\Downloads\Claude\Oppo Ecosystem\oppo-tracker"
npx tsc --noEmit
```
Expected: no errors relating to `rebates.ts`.

- [ ] **Step 4: Commit**

```powershell
git add lib/db/queries/rebates.ts
git commit -m "fix: use point-in-time stock in createRebatesForPriceDrop"
```

---

## Task 2: Add `reEvaluateRebatesForDealer` to `lib/db/queries/rebates.ts`

**Files:**
- Modify: `lib/db/queries/rebates.ts`

This new function re-evaluates all rebate records for a specific `(tenantId, dealerId, modelId)` starting from a given date. It is dealer-scoped: it only touches rebate rows for the specified dealer, leaving all other dealers untouched.

- [ ] **Step 1: Append the function at the bottom of `lib/db/queries/rebates.ts`**

```ts
/**
 * Re-evaluates rebates for a single dealer+model from `fromDate` forward.
 * Called whenever an activation is created, updated, or deleted — ensuring
 * that changing a unit's activation date does not leave stale rebate records.
 */
export async function reEvaluateRebatesForDealer(
  tenantId: string,
  dealerId: string,
  modelId: string,
  fromDate: string
): Promise<void> {
  const allEntries = await db
    .select({
      id: schema.modelPriceHistory.id,
      dealerPrice: schema.modelPriceHistory.dealerPrice,
      effectiveFrom: schema.modelPriceHistory.effectiveFrom,
    })
    .from(schema.modelPriceHistory)
    .where(
      and(
        eq(schema.modelPriceHistory.tenantId, tenantId),
        eq(schema.modelPriceHistory.modelId, modelId)
      )
    )
    .orderBy(asc(schema.modelPriceHistory.effectiveFrom));

  // Find the first price entry on or after the activation's date
  const startIdx = allEntries.findIndex((e) => e.effectiveFrom >= fromDate);
  if (startIdx === -1) return; // No price drops after this date — nothing to recalculate

  for (let i = startIdx; i < allEntries.length; i++) {
    const curr = allEntries[i];
    const prev = i > 0 ? allEntries[i - 1] : null;

    if (prev !== null && prev.dealerPrice > curr.dealerPrice) {
      // Price drop at curr.effectiveFrom — recompute this dealer's rebate
      const rebatePerUnit = prev.dealerPrice - curr.dealerPrice;
      const eligibleQty = await getStockForModelAsOf(tenantId, dealerId, modelId, curr.effectiveFrom);

      // Delete the existing rebate row for this dealer + price entry (if any)
      await db.delete(schema.rebates).where(
        and(
          eq(schema.rebates.tenantId, tenantId),
          eq(schema.rebates.priceHistoryId, curr.id),
          eq(schema.rebates.dealerId, dealerId)
        )
      );

      if (eligibleQty > 0) {
        await db.insert(schema.rebates).values({
          id: randomUUID(),
          tenantId,
          dealerId,
          modelId,
          oldDealerPrice: prev.dealerPrice,
          newDealerPrice: curr.dealerPrice,
          rebatePerUnit,
          eligibleQty,
          totalRebateAmount: eligibleQty * rebatePerUnit,
          rebateDate: curr.effectiveFrom,
          priceHistoryId: curr.id,
        });
      }
    } else {
      // Flat or price increase — remove any stale rebate for this dealer + price entry
      await db.delete(schema.rebates).where(
        and(
          eq(schema.rebates.tenantId, tenantId),
          eq(schema.rebates.priceHistoryId, curr.id),
          eq(schema.rebates.dealerId, dealerId)
        )
      );
    }
  }
}
```

- [ ] **Step 2: TypeScript check**

```powershell
cd "C:\Users\Admin\Downloads\Claude\Oppo Ecosystem\oppo-tracker"
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add lib/db/queries/rebates.ts
git commit -m "feat: add reEvaluateRebatesForDealer for activation-triggered reconciliation"
```

---

## Task 3: Hook Owner Portal Activation Actions

**Files:**
- Modify: `app/(app)/activations/actions.ts`

Hook `reEvaluateRebatesForDealer` into all 5 owner-portal activation mutations. The call is always fire-after-commit with `.catch(() => {})` — a rebate recalc failure must never roll back a successfully committed activation.

- [ ] **Step 1: Add import for `reEvaluateRebatesForDealer`**

At the top of `app/(app)/activations/actions.ts`, add to the existing imports:
```ts
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
```

- [ ] **Step 2: Hook `createActivationAction`**

After the `revalidatePath("/dashboard");` line inside `createActivationAction` (both the `qty === 1` and `qty > 1` branches return after this), add the rebate hook **before each `return { ok: true, ... }` statement**.

For the `qty === 1` branch, replace:
```ts
      revalidatePath("/activations");
      revalidatePath("/dashboard");
      return { ok: true, pricedAt: singleResult.pricedAt };
```
With:
```ts
      revalidatePath("/activations");
      revalidatePath("/dashboard");
      await reEvaluateRebatesForDealer(tenantId, dealerId, data.modelId, data.activationDate).catch(() => {});
      return { ok: true, pricedAt: singleResult.pricedAt };
```

For the `qty > 1` branch, replace:
```ts
    revalidatePath("/activations");
    revalidatePath("/dashboard");
    return { ok: true, pricedAt: price.dealerPrice, inserted };
```
With:
```ts
    revalidatePath("/activations");
    revalidatePath("/dashboard");
    await reEvaluateRebatesForDealer(tenantId, dealerId, data.modelId, data.activationDate).catch(() => {});
    return { ok: true, pricedAt: price.dealerPrice, inserted };
```

- [ ] **Step 3: Hook `bulkCreateActivationsByDateAction`**

After the `revalidatePath("/dashboard");` line (just before `return { ok: true, ... }`), add:
```ts
    revalidatePath("/activations");
    revalidatePath("/dashboard");
    for (const [modelId] of merged) {
      await reEvaluateRebatesForDealer(tenantId, dealerId, modelId, parsed.data.activationDate).catch(() => {});
    }
    return { ok: true, inserted, pricedAt: totalValue };
```

- [ ] **Step 4: Hook `updateActivationAction`**

The action already fetches `existing` (which has `existing.activationDate`). After `revalidatePath("/dashboard");`, add:

Replace:
```ts
    revalidatePath("/activations");
    revalidatePath("/dashboard");
    return { ok: true, pricedAt: price.dealerPrice };
```
With:
```ts
    revalidatePath("/activations");
    revalidatePath("/dashboard");
    const triggerDate = data.activationDate < existing.activationDate
      ? data.activationDate
      : existing.activationDate;
    await reEvaluateRebatesForDealer(tenantId, dealerId, data.modelId, triggerDate).catch(() => {});
    return { ok: true, pricedAt: price.dealerPrice };
```

- [ ] **Step 5: Hook `deleteActivationAction`**

Need to fetch the activation record before deleting so we have its `modelId` and `activationDate`. Replace the entire function:

```ts
export async function deleteActivationAction(id: string): Promise<void> {
  if (!(await isAuthenticated())) return;
  const dealerId = await getActiveDealerId();
  if (!dealerId) return;
  const activation = await getActivationById(id, dealerId, OWNER_TENANT_ID);
  await deleteActivation(id, dealerId, OWNER_TENANT_ID);
  await logAudit({
    action: "activation.delete",
    entityType: "activation",
    entityId: id,
    summary: `Deleted activation ${id.slice(0, 8)}`,
  });
  revalidatePath("/activations");
  revalidatePath("/dashboard");
  if (activation) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, activation.modelId, activation.activationDate).catch(() => {});
  }
}
```

- [ ] **Step 6: Hook `bulkDeleteActivationsAction`**

Need to fetch all activation records before deleting, then call recalc per model with the earliest date. Replace the entire function:

```ts
export async function bulkDeleteActivationsAction(
  ids: string[]
): Promise<{ deleted: number }> {
  if (!(await isAuthenticated())) return { deleted: 0 };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { deleted: 0 };
  const tenantId = OWNER_TENANT_ID;

  // Fetch before deleting so we have dates for rebate recalculation
  const activationRecords = (
    await Promise.all(ids.map((id) => getActivationById(id, dealerId, tenantId)))
  ).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getActivationById>>>[];

  let deleted = 0;
  await db.transaction(async () => {
    for (const id of ids) {
      await deleteActivation(id, dealerId, tenantId);
      deleted++;
    }
  });
  await logAudit({
    action: "activation.bulk_delete",
    summary: `Bulk deleted ${deleted} activation(s)`,
    payload: { ids },
  });
  revalidatePath("/activations");
  revalidatePath("/dashboard");

  // Recalculate rebates per model from the earliest deleted activation date
  const byModel = new Map<string, string>();
  for (const a of activationRecords) {
    const existing = byModel.get(a.modelId);
    if (!existing || a.activationDate < existing) byModel.set(a.modelId, a.activationDate);
  }
  for (const [modelId, fromDate] of byModel) {
    await reEvaluateRebatesForDealer(tenantId, dealerId, modelId, fromDate).catch(() => {});
  }

  return { deleted };
}
```

- [ ] **Step 7: TypeScript check**

```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```powershell
git add "app/(app)/activations/actions.ts"
git commit -m "feat: trigger rebate reconciliation on owner activation mutations"
```

---

## Task 4: Hook Dealer Portal Activation Actions

**Files:**
- Modify: `app/dealer/(portal)/activations/actions.ts`

Same pattern as Task 3. `getActivationById` is not yet imported in this file — add it.

- [ ] **Step 1: Add imports**

Add to the existing `activations` import:
```ts
import { listActivations, createActivation, deleteActivation, getActivationById } from "@/lib/db/queries/activations";
```

Add a new import for rebates:
```ts
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
```

- [ ] **Step 2: Hook `createDealerActivationAction`**

After `revalidatePath("/dealer/dashboard");` (just before `return { ok: true, ... }`), add:
```ts
  revalidatePath("/dealer/activations");
  revalidatePath("/dealer/dashboard");
  await reEvaluateRebatesForDealer(tenantId, dealerId, d.modelId, d.activationDate).catch(() => {});
  return { ok: true, inserted: qty, pricedAt };
```

- [ ] **Step 3: Hook `bulkCreateDealerActivationsByDateAction`**

After `revalidatePath("/dealer/dashboard");` (just before `return { ok: true, ... }`), add:
```ts
  revalidatePath("/dealer/activations");
  revalidatePath("/dealer/dashboard");
  for (const row of rowData) {
    await reEvaluateRebatesForDealer(tenantId, dealerId, row.modelId, activationDate).catch(() => {});
  }
  return { ok: true, inserted, pricedAt };
```

- [ ] **Step 4: Hook `deleteDealerActivationAction`**

Replace the entire function:
```ts
export async function deleteDealerActivationAction(id: string): Promise<void> {
  const session = await requireSession();
  const { tenantId, role } = session;
  if (role === "exec") throw new Error("Exec users cannot delete activations.");

  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) throw new Error("No active dealer ID.");

  const activation = await getActivationById(id, dealerId, tenantId);
  await deleteActivation(id, dealerId, tenantId);
  await logAudit({
    action: "dealer_activation_deleted",
    summary: `Dealer activation deleted: ${id.slice(0, 8)}`,
    dealerId,
  });
  revalidatePath("/dealer/activations");
  revalidatePath("/dealer/dashboard");
  if (activation) {
    await reEvaluateRebatesForDealer(tenantId, dealerId, activation.modelId, activation.activationDate).catch(() => {});
  }
}
```

- [ ] **Step 5: Hook `bulkDeleteDealerActivationsAction`**

Replace the entire function:
```ts
export async function bulkDeleteDealerActivationsAction(
  ids: string[],
): Promise<{ deleted: number }> {
  const session = await requireSession();
  const { tenantId, role } = session;
  if (role === "exec") throw new Error("Exec users cannot delete activations.");

  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) throw new Error("No active dealer ID.");

  // Fetch before deleting so we have dates for rebate recalculation
  const activationRecords = (
    await Promise.all(ids.map((id) => getActivationById(id, dealerId, tenantId)))
  ).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getActivationById>>>[];

  let deleted = 0;
  for (const id of ids) {
    try {
      await deleteActivation(id, dealerId, tenantId);
      deleted++;
    } catch {
      // skip individual failures
    }
  }

  await logAudit({
    action: "dealer_activation_bulk_deleted",
    summary: `Dealer bulk deleted ${deleted} activation(s)`,
    dealerId,
  });
  revalidatePath("/dealer/activations");
  revalidatePath("/dealer/dashboard");

  // Recalculate rebates per model from the earliest deleted activation date
  const byModel = new Map<string, string>();
  for (const a of activationRecords) {
    const existing = byModel.get(a.modelId);
    if (!existing || a.activationDate < existing) byModel.set(a.modelId, a.activationDate);
  }
  for (const [modelId, fromDate] of byModel) {
    await reEvaluateRebatesForDealer(tenantId, dealerId, modelId, fromDate).catch(() => {});
  }

  return { deleted };
}
```

- [ ] **Step 6: TypeScript check**

```powershell
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```powershell
git add "app/dealer/(portal)/activations/actions.ts"
git commit -m "feat: trigger rebate reconciliation on dealer activation mutations"
```

---

## Task 5: End-to-End Verification

Manual test of the exact scenario that motivated this feature.

- [ ] **Step 1: Set up the scenario in the running app**

In the owner portal:
1. Ensure model A6c has a price drop entry (e.g., May 5, 2026 — 35100 → 34100 PKR)
2. Ensure dealer has at least 2 units purchased before May 5
3. Confirm the rebate table shows 2 units × 1000 PKR = 2000 PKR for that price drop

- [ ] **Step 2: Backdate an activation to before the price drop**

Add an activation for A6c dated **May 4, 2026** (before the May 5 drop).

Expected: After save, the rebate for the May 5 price drop **automatically updates to 1 unit × 1000 = 1000 PKR** without any manual price-edit step.

- [ ] **Step 3: Verify rebate decreased**

Navigate to the rebates view (owner dashboard → model rebates, or the reports section). Confirm the May 5 rebate now shows `eligibleQty = 1`, `totalRebateAmount = 1000`.

- [ ] **Step 4: Delete the backdated activation**

Delete the May 4 activation.

Expected: Rebate for May 5 **automatically reverts to 2 units × 1000 = 2000 PKR**.

- [ ] **Step 5: Test bulk delete path**

Add two activations dated May 3 and May 4. Bulk-delete both.

Expected: Single recalc pass from May 3 — rebate reverts to 2 units.

- [ ] **Step 6: Final TypeScript check**

```powershell
npx tsc --noEmit
```
Expected: clean.

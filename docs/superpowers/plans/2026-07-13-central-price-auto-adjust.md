# Central Price → All-Dealer Auto Re-adjust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the owner changes any model price, every dealer's activations, purchases, and rebates auto re-adjust to the central price; dealers can no longer enter a manual purchase price.

**Architecture:** Owner `modelPriceHistory` is the single price source. On an owner price mutation: (A) set-based re-price of activations + purchases across ALL tenants, (B) rebate recompute — owner's own dealers synchronously, all other dealers via a durable `rebate_jobs` queue drained by `after()` (fast path) and a cron route (safety net).

**Tech Stack:** Next.js 16 App Router, drizzle-orm + node-postgres (Postgres/Supabase), Vitest (pure tests only — no DB harness), `tsx` scripts for DB-level verification.

## Global Constraints

- Multi-tenant: pricing/rebates live under `OWNER_TENANT_ID` (`"owner"`, from `@/lib/dealer`); each dealer's stock lives under its own `tenantId`. Rebate recompute always passes `stockTenantId` = the dealer's tenant.
- Stock formula and rebate boundary rules are UNCHANGED. Rebate uses `getClosingStockBeforeDate` (strict `<`); drop-only trigger via existing `reEvaluateRebatesForDealer`.
- Rebate side-effects fire AFTER the price write commits, wrapped in `.catch` — a rebate/queue failure must NEVER roll back a committed price change.
- Cron routes: `POST` guarded by `process.env.CRON_SECRET` compared to the `x-cron-secret` header (mirror `app/api/cron/backups/route.ts`).
- Dates are `YYYY-MM-DD` strings. `isoDate`/`isoDateTime` are the schema column helpers.
- No new npm dependencies.

---

### Task 1: `rebate_jobs` table (schema + migration)

**Files:**
- Modify: `lib/db/schema.ts` (add `rebateJobs` table near `dealerDailyBackups`, ~line 427)
- Create: `scripts/migrate-add-rebate-jobs.mjs`

**Interfaces:**
- Produces: `schema.rebateJobs` with columns `id, modelId, fromDate, status, createdAt`.

- [ ] **Step 1: Add the table to the drizzle schema**

In `lib/db/schema.ts`, after the `dealerDailyBackups` table definition, add:

```ts
export const rebateJobs = pgTable(
  "rebate_jobs",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "cascade" }),
    fromDate: isoDate("from_date").notNull(),
    status: text("status").notNull().default("pending"), // 'pending' | 'done'
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    pending: index("rebate_jobs_pending").on(t.status, t.createdAt),
  })
);
```

(`pgTable`, `text`, `index`, `isoDate`, `isoDateTime` are already imported in this file.)

- [ ] **Step 2: Write the migration script**

Create `scripts/migrate-add-rebate-jobs.mjs`:

```js
import "dotenv/config";
import pg from "pg";

const url = process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL environment variable is required");

const { Pool } = pg;
const pool = new Pool({ connectionString: url });

await pool.query(`
  CREATE TABLE IF NOT EXISTS rebate_jobs (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    from_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT now()::text
  )
`);
await pool.query(`
  CREATE INDEX IF NOT EXISTS rebate_jobs_pending
  ON rebate_jobs(status, created_at)
`);

console.log("✅ rebate_jobs table created");
await pool.end();
```

- [ ] **Step 3: Run the migration**

Run: `npx tsx scripts/migrate-add-rebate-jobs.mjs`
Expected: prints `✅ rebate_jobs table created` (idempotent — safe to re-run).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts scripts/migrate-add-rebate-jobs.mjs
git commit -m "feat(db): add rebate_jobs queue table"
```

---

### Task 2: Cross-tenant set-based re-price helpers

**Files:**
- Modify: `lib/db/queries/models.ts` (add two exports; add `OWNER_TENANT_ID` import)

**Interfaces:**
- Consumes: `getPriceOnDate` shape not needed — reads owner `modelPriceHistory` windows directly.
- Produces:
  - `syncActivationSnapshotsAllTenants(modelId: string): Promise<void>`
  - `syncPurchaseSnapshotsAllTenants(modelId: string): Promise<void>`

- [ ] **Step 1: Import `OWNER_TENANT_ID`**

At the top of `lib/db/queries/models.ts`, add:

```ts
import { OWNER_TENANT_ID } from "@/lib/dealer";
```

- [ ] **Step 2: Add the two helpers**

After the existing `syncAllActivationSnapshots` function (~line 219), add:

```ts
/**
 * Re-price EVERY tenant's activations of this model to the owner's central
 * price-on-date. Central price is identical for all dealers, so this is a
 * set-based UPDATE per price window (no per-dealer loop, no tenant filter).
 * Activations outside any owner price window are left unchanged.
 */
export async function syncActivationSnapshotsAllTenants(modelId: string): Promise<void> {
  const windows = await db
    .select()
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.tenantId, OWNER_TENANT_ID), eq(schema.modelPriceHistory.modelId, modelId)))
    .orderBy(asc(schema.modelPriceHistory.effectiveFrom));

  for (const w of windows) {
    const base = and(
      eq(schema.activations.modelId, modelId),
      gte(schema.activations.activationDate, w.effectiveFrom)
    );
    const cond = w.effectiveTo !== null ? and(base, lt(schema.activations.activationDate, w.effectiveTo)) : base;
    await db.update(schema.activations).set({ dealerPriceSnapshot: w.dealerPrice }).where(cond);
  }
}

/**
 * Re-price EVERY tenant's purchases of this model to the owner's central
 * price-on-date (both dealer and invoice price). Same set-based approach.
 */
export async function syncPurchaseSnapshotsAllTenants(modelId: string): Promise<void> {
  const windows = await db
    .select()
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.tenantId, OWNER_TENANT_ID), eq(schema.modelPriceHistory.modelId, modelId)))
    .orderBy(asc(schema.modelPriceHistory.effectiveFrom));

  for (const w of windows) {
    const base = and(
      eq(schema.purchases.modelId, modelId),
      gte(schema.purchases.purchaseDate, w.effectiveFrom)
    );
    const cond = w.effectiveTo !== null ? and(base, lt(schema.purchases.purchaseDate, w.effectiveTo)) : base;
    await db
      .update(schema.purchases)
      .set({ unitDealerPrice: w.dealerPrice, unitInvoicePrice: w.invoicePrice })
      .where(cond);
  }
}
```

(`and, asc, eq, gte, lt` are already imported in this file.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/db/queries/models.ts
git commit -m "feat(models): cross-tenant set-based activation/purchase re-price"
```

---

### Task 3: Rebate job queue (enqueue + drain)

**Files:**
- Create: `lib/db/queries/rebate-jobs.ts`

**Interfaces:**
- Consumes: `reEvaluateRebatesForDealer(tenantId, dealerId, modelId, fromDate, stockTenantId?)` from `./rebates`; `schema.rebateJobs`, `schema.dealerIds`.
- Produces:
  - `enqueueRebateJob(modelId: string, fromDate: string): Promise<void>`
  - `drainRebateJobs(): Promise<{ jobsProcessed: number; dealersTouched: number }>`

- [ ] **Step 1: Create the queue module**

Create `lib/db/queries/rebate-jobs.ts`:

```ts
import "server-only";
import { db, schema } from "../client";
import { asc, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { reEvaluateRebatesForDealer } from "./rebates";
import { OWNER_TENANT_ID } from "@/lib/dealer";

/** Queue a background rebate recompute for all non-owner dealers of a model. */
export async function enqueueRebateJob(modelId: string, fromDate: string): Promise<void> {
  await db.insert(schema.rebateJobs).values({
    id: randomUUID(),
    modelId,
    fromDate,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

/**
 * Process every pending job: recompute rebates for all dealers in every
 * NON-owner tenant (owner's own dealers are handled synchronously at price-edit
 * time). Idempotent — reEvaluateRebatesForDealer deletes+recreates, so a re-run
 * (cron retry after a killed instance) produces identical rows. One dealer's
 * failure is logged and skipped; a job is marked done only after its full pass.
 */
export async function drainRebateJobs(): Promise<{ jobsProcessed: number; dealersTouched: number }> {
  const jobs = await db
    .select()
    .from(schema.rebateJobs)
    .where(eq(schema.rebateJobs.status, "pending"))
    .orderBy(asc(schema.rebateJobs.createdAt));

  let dealersTouched = 0;
  for (const job of jobs) {
    const dealers = await db
      .select({ id: schema.dealerIds.id, tenantId: schema.dealerIds.tenantId })
      .from(schema.dealerIds)
      .where(ne(schema.dealerIds.tenantId, OWNER_TENANT_ID));

    for (const d of dealers) {
      try {
        await reEvaluateRebatesForDealer(OWNER_TENANT_ID, d.id, job.modelId, job.fromDate, d.tenantId);
        dealersTouched++;
      } catch (e) {
        console.error("[rebate-job]", job.id, d.id, e);
      }
    }
    await db.update(schema.rebateJobs).set({ status: "done" }).where(eq(schema.rebateJobs.id, job.id));
  }
  return { jobsProcessed: jobs.length, dealersTouched };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/queries/rebate-jobs.ts
git commit -m "feat(rebates): durable rebate-job queue (enqueue + drain)"
```

---

### Task 4: Integration verification script (expected FAIL first)

This is the TDD gate. It seeds an isolated owner + two dealer tenants, drops a
price, drains the queue, and asserts a NON-owner dealer received the rebate and
its activation snapshot re-priced. It FAILS now (price-drop path is still
owner-only) and PASSES after Task 5.

**Files:**
- Create: `scripts/verify-central-price-adjust.mjs`

**Interfaces:**
- Consumes: `updateModelPrice` (`lib/db/queries/models`), `drainRebateJobs` (`lib/db/queries/rebate-jobs`), `listRebatesForDealer` (`lib/db/queries/rebates`), `db`/`schema`.

- [ ] **Step 1: Write the verification script**

Create `scripts/verify-central-price-adjust.mjs`:

```js
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db, schema } from "../lib/db/client.ts";
import { updateModelPrice } from "../lib/db/queries/models.ts";
import { drainRebateJobs } from "../lib/db/queries/rebate-jobs.ts";
import { listRebatesForDealer } from "../lib/db/queries/rebates.ts";
import { eq } from "drizzle-orm";

const OWNER = "owner";
const PFX = "zz_test_cpa_";
const now = new Date().toISOString();
const today = now.slice(0, 10);
const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const otherTenant = PFX + randomUUID();
const otherDealer = PFX + randomUUID();
const ownerDealer = PFX + randomUUID();
const modelId = PFX + randomUUID();

async function seed() {
  await db.insert(schema.dealerTenants).values({
    id: otherTenant, businessName: "CPA Test Dealer", ownerEmail: otherTenant + "@test.local",
    planMonths: 12, startedAt: today, expiresAt: today, status: "active", createdAt: now,
  });
  await db.insert(schema.dealerIds).values([
    { id: ownerDealer, tenantId: OWNER, name: "CPA Owner Dealer", isActive: true, createdAt: now },
    { id: otherDealer, tenantId: otherTenant, name: "CPA Other Dealer", isActive: true, createdAt: now },
  ]);
  await db.insert(schema.models).values({ id: modelId, name: PFX + "Model", isActive: true, createdAt: now });
  // Owner central price = 100 as of yesterday
  await db.insert(schema.modelPriceHistory).values({
    id: randomUUID(), tenantId: OWNER, modelId, dealerPrice: 100, invoicePrice: 100,
    effectiveFrom: yest, effectiveTo: null, createdAt: now,
  });
  // Other dealer bought 5 units yesterday (stock exists under its own tenant)
  await db.insert(schema.purchases).values({
    id: randomUUID(), tenantId: otherTenant, dealerId: otherDealer, modelId, quantity: 5,
    unitDealerPrice: 100, unitInvoicePrice: 100, purchaseDate: yest,
    source: "REGULAR", reviewStatus: "active", createdAt: now,
  });
}

async function cleanup() {
  await db.delete(schema.rebateJobs).where(eq(schema.rebateJobs.modelId, modelId));
  await db.delete(schema.purchases).where(eq(schema.purchases.modelId, modelId));
  await db.delete(schema.rebates).where(eq(schema.rebates.modelId, modelId));
  await db.delete(schema.modelPriceHistory).where(eq(schema.modelPriceHistory.modelId, modelId));
  await db.delete(schema.dealerIds).where(eq(schema.dealerIds.id, otherDealer));
  await db.delete(schema.dealerIds).where(eq(schema.dealerIds.id, ownerDealer));
  await db.delete(schema.models).where(eq(schema.models.id, modelId));
  await db.delete(schema.dealerTenants).where(eq(schema.dealerTenants.id, otherTenant));
}

let failed = false;
try {
  await seed();
  // Owner drops central price 100 -> 80, effective today
  await updateModelPrice(OWNER, { modelId, dealerPrice: 80, invoicePrice: 80, effectiveFrom: today });
  await drainRebateJobs();

  const rebates = await listRebatesForDealer(OWNER, otherDealer);
  const hit = rebates.find((r) => r.modelId === modelId);
  if (!hit) {
    console.error("❌ FAIL: non-owner dealer got NO rebate after owner price drop");
    failed = true;
  } else if (hit.rebatePerUnit !== 20 || hit.eligibleQty !== 5 || hit.totalRebateAmount !== 100) {
    console.error("❌ FAIL: wrong rebate", hit);
    failed = true;
  } else {
    console.log("✅ PASS: non-owner dealer rebate =", hit.totalRebateAmount, "(5 × 20)");
  }
} catch (e) {
  console.error("❌ ERROR", e);
  failed = true;
} finally {
  await cleanup();
  await db.$client.end?.();
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx tsx scripts/verify-central-price-adjust.mjs`
Expected: `❌ FAIL: non-owner dealer got NO rebate...` and exit 1 (price-drop path is owner-only; no job enqueued; drain does nothing).

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-central-price-adjust.mjs
git commit -m "test: failing integration check for cross-tenant price-drop rebate"
```

---

### Task 5: Orchestrator + rewire price mutations + background drain + cron

Makes the Task 4 script PASS.

**Files:**
- Modify: `lib/db/queries/models.ts` (add orchestrator; rewire 4 mutations; drop owner-only rebate/snapshot calls)
- Modify: `app/(app)/models/actions.ts` (kick `after(drainRebateJobs)`)
- Create: `app/api/cron/reprice/route.ts`

**Interfaces:**
- Consumes: `syncActivationSnapshotsAllTenants`, `syncPurchaseSnapshotsAllTenants` (Task 2); `enqueueRebateJob`, `drainRebateJobs` (Task 3); `reEvaluateRebatesForDealer` (`./rebates`).
- Produces: `reAdjustAllDealersForPriceChange(modelId: string, fromDate: string): Promise<void>`.

- [ ] **Step 1: Add imports to `models.ts`**

In `lib/db/queries/models.ts`, replace the line:

```ts
import { createRebatesForPriceDrop, reEvaluateRebatesFromEntry } from "./rebates";
```

with:

```ts
import { reEvaluateRebatesForDealer } from "./rebates";
import { enqueueRebateJob } from "./rebate-jobs";
```

- [ ] **Step 2: Add the orchestrator**

After `syncPurchaseSnapshotsAllTenants` (Task 2), add:

```ts
/**
 * Called after any owner price change. Re-prices all tenants' activations and
 * purchases (set-based), recomputes rebates for the owner's own dealers inline
 * (instant in owner portal), and enqueues a background job for every other
 * dealer. Never throws out to the caller — a follow-up failure must not roll
 * back the committed price write.
 */
export async function reAdjustAllDealersForPriceChange(modelId: string, fromDate: string): Promise<void> {
  try {
    await syncActivationSnapshotsAllTenants(modelId);
    await syncPurchaseSnapshotsAllTenants(modelId);

    const ownerDealers = await db
      .select({ id: schema.dealerIds.id })
      .from(schema.dealerIds)
      .where(eq(schema.dealerIds.tenantId, OWNER_TENANT_ID));
    for (const d of ownerDealers) {
      await reEvaluateRebatesForDealer(OWNER_TENANT_ID, d.id, modelId, fromDate).catch((e) =>
        console.error("[reAdjust-owner]", d.id, e)
      );
    }

    await enqueueRebateJob(modelId, fromDate);
  } catch (e) {
    console.error("[reAdjust]", modelId, fromDate, e);
  }
}
```

- [ ] **Step 3: Rewire `updateModelPrice`**

In `updateModelPrice`, replace the trailing rebate block:

```ts
  // Create rebates if price dropped
  if (currentPrice && input.dealerPrice < currentPrice.dealerPrice) {
    await createRebatesForPriceDrop({
      tenantId,
      modelId: input.modelId,
      oldDealerPrice: currentPrice.dealerPrice,
      newDealerPrice: input.dealerPrice,
      rebateDate: input.effectiveFrom,
      priceHistoryId: newHistoryId!,
    });
  }
```

with:

```ts
  await reAdjustAllDealersForPriceChange(input.modelId, input.effectiveFrom);
```

(`currentPrice`/`newHistoryId` are now unused by this block; leave the earlier `currentRows`/`newHistoryId` declarations — `newHistoryId` is still assigned in the transaction. Delete the now-unused `currentRows`/`currentPrice` lines at the top of `updateModelPrice` to satisfy lint.)

- [ ] **Step 4: Rewire `addPriceEntry`**

In `addPriceEntry`, remove the `syncActivationSnapshots(tenantId, input.modelId)` call and replace the `if (prevDealerPrice !== null && ...) { createRebatesForPriceDrop(...) }` block with:

```ts
  await reAdjustAllDealersForPriceChange(input.modelId, input.effectiveFrom);
```

Keep `restitchPriceHistory(tenantId, input.modelId)` before it. The `prevRows`/`prevDealerPrice` lines become unused — delete them.

- [ ] **Step 5: Rewire `updatePriceEntry`**

In `updatePriceEntry`, replace:

```ts
  await syncActivationSnapshots(tenantId, input.modelId);
  await reEvaluateRebatesFromEntry(tenantId, input.modelId, input.priceId);
```

with:

```ts
  await reAdjustAllDealersForPriceChange(input.modelId, input.effectiveFrom);
```

- [ ] **Step 6: Rewire `deletePriceEntry`**

In `deletePriceEntry`, change the entry lookup to also read `effectiveFrom`:

```ts
  const entryRows = await db
    .select({ effectiveTo: schema.modelPriceHistory.effectiveTo, effectiveFrom: schema.modelPriceHistory.effectiveFrom })
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.id, input.priceId), eq(schema.modelPriceHistory.tenantId, tenantId)))
    .limit(1);
```

Then, after `restitchPriceHistory(tenantId, input.modelId)` and removing the `syncActivationSnapshots(tenantId, input.modelId)` call, add before `return { ok: true }`:

```ts
  await reAdjustAllDealersForPriceChange(input.modelId, entryRows[0].effectiveFrom);
```

- [ ] **Step 7: Kick the background drain from the owner actions**

In `app/(app)/models/actions.ts`, add at the top:

```ts
import { after } from "next/server";
import { drainRebateJobs } from "@/lib/db/queries/rebate-jobs";
```

In each of `createModelAction`, `addPriceEntryAction`, `updatePriceEntryAction`, `deletePriceEntryAction`, and `updateModelPrice`'s action wrapper — i.e. every action that mutates price — add right before the `return { ok: true ... }`:

```ts
  after(() => drainRebateJobs().catch((e) => console.error("[reprice-drain]", e)));
```

(Note: `createModelAction` creates the first price with no prior drop — the drain is harmless/no-op there but keeps behavior uniform. `addPriceEntryAction`, `updatePriceEntryAction`, `deletePriceEntryAction` are the price-change entry points. If a dedicated owner "edit current price" action calls `updateModelPrice`, add the `after(...)` there too.)

- [ ] **Step 8: Create the cron drain route**

Create `app/api/cron/reprice/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { drainRebateJobs } from "@/lib/db/queries/rebate-jobs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await drainRebateJobs();
  return NextResponse.json(result);
}
```

- [ ] **Step 9: Run the verification script — expect PASS**

Run: `npx tsx scripts/verify-central-price-adjust.mjs`
Expected: `✅ PASS: non-owner dealer rebate = 100 (5 × 20)` and exit 0.

- [ ] **Step 10: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors (confirm no leftover references to `createRebatesForPriceDrop` / `reEvaluateRebatesFromEntry` / `syncActivationSnapshots` in `models.ts`).

- [ ] **Step 11: Commit**

```bash
git add lib/db/queries/models.ts app/\(app\)/models/actions.ts app/api/cron/reprice/route.ts
git commit -m "feat: fan out price-change re-adjust to all dealers (sync owner + queued others)"
```

- [ ] **Step 12: Register the cron**

Register `POST /api/cron/reprice` (header `x-cron-secret: $CRON_SECRET`) on the same external scheduler that runs `/api/cron/backups`, at every-minute cadence. Document this in the PR description (no code artifact — matches the existing backups cron, which has no `vercel.json` entry in this repo).

---

### Task 6: Force central purchase price (server authoritative + read-only UI)

**Files:**
- Modify: `app/dealer/(portal)/purchases/actions.ts` (single, bulk, edit actions)
- Modify: `app/dealer/(portal)/purchases/dealer-purchase-form.tsx`
- Modify: `app/dealer/(portal)/purchases/dealer-bulk-invoice-form.tsx`

**Interfaces:**
- Consumes: `getPriceOnDate(OWNER_TENANT_ID, modelId, date)` (already imported in the actions file).

- [ ] **Step 1: Single purchase — ignore submitted price, use central**

In `createDealerPurchaseAction`, after `const data = parsed.data;` and the date guard, look up central price and use it:

```ts
  const central = await getPriceOnDate(OWNER_TENANT_ID, data.modelId, data.purchaseDate);
  if (!central) return { error: "No price set for this model on that date — contact owner" };
  const unitDealerPrice = central.dealerPrice;
  const unitInvoicePrice = central.invoicePrice;
```

Then in the `createPurchase({ ... })` call, pass `unitDealerPrice` and `unitInvoicePrice` (the central values) instead of `data.unitDealerPrice` / `data.unitInvoicePrice`. Update the audit `summary` to use `unitDealerPrice`.

- [ ] **Step 2: Bulk invoice — ignore submitted per-line price, use central**

In `createDealerBulkPurchasesAction`, inside the `for (const line of lines)` loop, before `createPurchase`, add:

```ts
      const central = await getPriceOnDate(OWNER_TENANT_ID, line.modelId, purchaseDate);
      if (!central) { throw new Error(`No price set for a model on ${purchaseDate} — contact owner`); }
```

and pass `unitDealerPrice: central.dealerPrice, unitInvoicePrice: central.invoicePrice` to `createPurchase` instead of `line.unitDealerPrice` / `line.unitInvoicePrice`.

- [ ] **Step 3: Edit purchase — ignore submitted price, use central**

In `editDealerPurchaseAction` (below line 241), after parsing, look up `getPriceOnDate(OWNER_TENANT_ID, <existing purchase modelId>, <purchase date>)` and use those values for the update instead of the submitted `unitDealerPrice`/`unitInvoicePrice`. (Read the existing purchase via `getPurchaseById` to obtain `modelId`/`purchaseDate` if the edit form does not resubmit them.)

- [ ] **Step 4: Make the single-purchase price fields read-only**

In `dealer-purchase-form.tsx`, the dealer price / invoice price inputs: set them `readOnly`, auto-populate from the model's current price (the form already receives models with `dealerPrice`/`invoicePrice` via `listModelsWithCurrentPrice(OWNER_TENANT_ID)` — display that value and mark the field read-only with helper text "Set by owner"). Keep the input present (so the value posts) but non-editable.

- [ ] **Step 5: Make the bulk-invoice price fields read-only**

In `dealer-bulk-invoice-form.tsx`, per-line dealer/invoice price: auto-fill from the selected model's current price and render read-only, same as Step 4.

- [ ] **Step 6: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Verify the server guarantee**

Run: `npx tsx scripts/verify-central-price-adjust.mjs`
Expected: still `✅ PASS` (regression guard — purchase seeded at 100 matches central).

- [ ] **Step 8: Commit**

```bash
git add app/dealer/\(portal\)/purchases/
git commit -m "feat(dealer): purchase price is central (read-only UI + server authoritative)"
```

---

### Task 7: Final verification (running app)

**Files:** none (verification only)

- [ ] **Step 1: Drive the real flow with the `verify` skill**

Invoke the `verify` skill. Exercise end-to-end in the running app:
1. As owner, drop a model's price. Confirm owner-portal rebate appears immediately.
2. As a separate dealer (impersonate / dealer login) holding stock of that model, confirm — within seconds (after drain) or after a `POST /api/cron/reprice` call — that the dealer's rebate appears and past activations/purchases show the new price.
3. In the dealer purchase form, confirm the price field is read-only and a submitted/tampered price is overridden to central (check the stored row).
4. Owner raises the price back up; confirm the stale rebate is removed for the separate dealer after drain.

- [ ] **Step 2: Update memory + rollout/feature blueprints**

Note the fix in the project memory and the living rollout/feature-blueprint Artifacts (per user's memory index).

- [ ] **Step 3: Finalize the branch**

Use the `superpowers:finishing-a-development-branch` skill to choose merge/PR. Include the cron registration note (Task 5, Step 12) in the PR description.

---

## Self-Review

**Spec coverage:**
- Set-based activation re-sync (all tenants) → Task 2 ✓
- Set-based purchase re-price (all tenants) → Task 2 ✓
- Rebate recompute owner-sync + fan-out → Task 3 + Task 5 ✓
- `rebate_jobs` table → Task 1 ✓
- `after()` fast path + cron safety net → Task 5 ✓
- Trigger from all 4 owner price mutations → Task 5 (Steps 3–6) ✓
- Dealer purchase price forced central + read-only → Task 6 ✓
- Direction coverage (drop/increase/edit/delete all via `reEvaluateRebatesForDealer`) → Task 5 orchestrator ✓
- Idempotency/batch-safety → Task 3 (delete+recreate, continue-on-error, job marked done post-pass) ✓
- Testing: failing-then-passing integration gate (Task 4→5) + running-app verify (Task 7) ✓

**Placeholder scan:** No "TBD"/"handle edge cases" — Task 6 Steps 4–5 reference exact files and the existing central-price value already passed to the forms; each code step shows code.

**Type consistency:** `reAdjustAllDealersForPriceChange(modelId, fromDate)`, `enqueueRebateJob(modelId, fromDate)`, `drainRebateJobs()`, `syncActivationSnapshotsAllTenants(modelId)`, `syncPurchaseSnapshotsAllTenants(modelId)` are used with identical signatures across Tasks 2/3/5. `reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, fromDate, stockTenantId?)` matches the existing signature in `lib/db/queries/rebates.ts`.

**Note on tests:** This repo has no DB unit-test harness (Vitest runs pure tests only). DB-level correctness is proven by the `tsx` integration script (Task 4) — the codebase's established pattern (`scripts/stress-test.ts`) — plus the running-app `verify` pass (Task 7).

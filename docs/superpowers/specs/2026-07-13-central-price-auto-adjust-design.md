# Central Price → All-Dealer Auto Re-adjust — Design

**Date:** 2026-07-13
**Status:** Approved (design)
**Branch:** `feat/central-price-auto-adjust`

## Problem

The owner sets one central price per model (stored under `OWNER_TENANT_ID`
`modelPriceHistory`). All dealers already **read** price from the owner
(`getPriceOnDate(OWNER_TENANT_ID, ...)` in dealer purchases/activations). When
the owner **drops** a price, dealers holding stock should receive a rebate, and
their stored figures should follow the new price.

Today only the owner's **own** dealer IDs re-adjust immediately. Separate dealer
tenants do not — their rebate is recomputed only lazily, when that dealer next
records their own purchase/activation/CR. Root cause:

- `createRebatesForPriceDrop({ tenantId })` (`lib/db/queries/rebates.ts`)
  enumerates only `dealerIds WHERE tenantId = input.tenantId` and reads stock
  from that same tenant. Called with `OWNER_TENANT_ID`, it covers owner's own
  dealer IDs only.
- `syncActivationSnapshots(tenantId, modelId)` (`lib/db/queries/models.ts`) runs
  only for `OWNER_TENANT_ID`, so other dealers' past activation
  `dealerPriceSnapshot` values stay stale after an owner price edit.

`reEvaluateRebatesForDealer` already accepts a separate `stockTenantId` (the
cross-tenant fix for the activation path) — but the price-mutation path was
never upgraded to fan out across tenants.

**Why tests missed it:** price-drop testing was done on the owner's own dealer
IDs (single tenant), where the code works. The gap only appears with real,
separate dealer accounts, which were added late.

## Goal

When the owner changes a model price (increase / decrease / edit / delete of a
price window), **every dealer's** derived figures re-adjust to the central
price automatically:

1. Past **activations** re-priced (`dealerPriceSnapshot`).
2. Past **purchases** re-priced (`unitDealerPrice`, `unitInvoicePrice`).
3. **Rebates** recomputed for all dealers.

Plus: dealers can no longer enter a manual purchase price — purchase price is
always the central price, so no dealer-entered price can conflict with rebates.

## Non-goals

- No change to the rebate math itself (`getClosingStockBeforeDate`, strict `<`
  boundary, drop-only trigger all unchanged).
- No change to how dealers *read* current price (already central).
- Owner's own purchase-entry flow is out of scope for the price-field disable
  (this change targets the dealer portal purchase form). Owner controls price
  via the models page.
- Dealer per-tenant `modelPriceHistory` copies (`seedDealerPricesFromOwner`)
  remain dormant/unused for pricing; not removed (minimal diff).

## Architecture

Single source of truth: owner `modelPriceHistory`. Every dealer figure is
derived from it. On an owner price mutation we re-derive in two phases.

### Phase A — synchronous, set-based (inside the save; fast)

Central price for a model on a given date is identical for all dealers, so
re-pricing is a set-based UPDATE with **no tenant filter** — not a per-dealer
loop.

- `syncActivationSnapshotsAllTenants(modelId)` — for each owner price window,
  one `UPDATE activations SET dealerPriceSnapshot = <window price> WHERE
  modelId = ? AND activationDate ∈ [effectiveFrom, effectiveTo)`. Cross-tenant
  variant of the existing `syncActivationSnapshots`.
- `syncPurchaseSnapshotsAllTenants(modelId)` — same shape, updating
  `unitDealerPrice` and `unitInvoicePrice` on `purchases`.

Bounded cost: one model, a handful of price windows → a few UPDATEs total.

### Phase B — rebate recompute (per-dealer; background)

Rebate eligible quantity depends on each dealer's own stock, so this is
genuinely per-dealer. To stay fast and reliable at ~400 dealers:

1. **Owner's own dealers:** recompute **synchronously** in-request (small count)
   so the owner's own portal is instantly correct — preserves today's behavior.
2. **All other dealers:** insert one row into a new `rebate_jobs` table
   `(id, modelId, fromDate, status, createdAt)` and return immediately.
3. **Fast drain:** Next.js `after()` (from `next/server`) kicks the drain right
   after the response — other dealers are typically done within seconds.
4. **Safety net:** a `CRON_SECRET`-guarded route `GET /api/cron/reprice`
   (mirrors `app/api/cron/backups/route.ts`), scheduled every minute, drains any
   `pending` job — catches anything `after()` dropped (instance killed) and
   retries.

**Drain logic** (`processRebateJobs`, batched):
- Load `SELECT id, tenantId FROM dealer_ids` for all tenants **except** owner
  (owner already done synchronously).
- For each, call
  `reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, fromDate, stockTenantId = tenantId)`.
- Process in batches of N (e.g. 50) per invocation; if more remain, leave job
  `pending` for the next `after()`/cron pass. Idempotent — `reEvaluateRebatesForDealer`
  deletes and recreates, so re-running is safe.

`reEvaluateRebatesForDealer` handles all directions: a drop creates the rebate,
an increase/flat/edit deletes any now-stale rebate for that window. So
increase, decrease, edit, and window delete are all covered.

### Trigger wiring

All four owner price mutations in `lib/db/queries/models.ts` run: Phase A, then
Phase B (owner sync + enqueue). Replaces the current owner-only
`createRebatesForPriceDrop` / `reEvaluateRebatesFromEntry` calls:

- `updateModelPrice` — fromDate = `input.effectiveFrom`
- `addPriceEntry` — fromDate = `input.effectiveFrom`
- `updatePriceEntry` — fromDate = edited entry's `effectiveFrom`
- `deletePriceEntry` — fromDate = deleted entry's `effectiveFrom`

Pattern per CLAUDE.md: fire after the price write commits; enqueue/`after()`
failures must never roll back the committed price change (`.catch`).

### Dealer purchase price field disabled

- **UI:** dealer purchase form (single + bulk invoice) — dealer price /
  invoice price inputs become read-only, auto-filled from
  `getPriceOnDate(OWNER_TENANT_ID, modelId, date)` (same as activations today).
- **Server (authoritative):** in the dealer purchase actions, ignore any
  submitted price and look up the central price server-side before insert. This
  is the real guarantee; the UI change is convenience.

## Data model change

New table `rebate_jobs`:

| column     | type   | notes                                  |
|------------|--------|----------------------------------------|
| id         | text   | pk                                     |
| modelId    | text   | FK models.id                           |
| fromDate   | isoDate| earliest affected effectiveFrom        |
| status     | text   | `pending` \| `done` (default pending)  |
| createdAt  | isoDateTime |                                   |

Index on `(status, createdAt)`. Migration via the existing
`scripts/migrate-*.mjs` pattern.

## Error handling & idempotency

- Rebate recompute is delete+recreate per (dealer, price window) → safe to run
  repeatedly; `after()` + cron overlap cannot double-count.
- Enqueue/`after()`/cron failures are logged, never roll back the price write.
- Cron route returns counts (jobs processed, dealers touched) for observability.
- Batching prevents function timeout at high dealer counts.

## Testing (test-first)

Unit / integration (Vitest, existing harness):
1. **Failing test first:** owner price **drop** → a **separate-tenant** dealer
   holding stock gets a rebate immediately after the mutation's synchronous +
   drained work (drive the drain directly in the test).
2. Set-based re-sync updates a separate-tenant dealer's past **activations** and
   **purchases** to the new price.
3. Owner price **increase** → separate-tenant dealer's stale rebate is deleted.
4. `processRebateJobs` is idempotent (run twice → identical rebate rows).
5. Dealer purchase action ignores a submitted price and stores the central
   price.

## Files

- `lib/db/queries/models.ts` — add `syncActivationSnapshotsAllTenants`,
  `syncPurchaseSnapshotsAllTenants`; rewire 4 price mutations.
- `lib/db/queries/rebates.ts` — `reEvaluateRebatesForAllDealers` /
  `processRebateJobs` helpers (owner sync + fan-out).
- `lib/db/queries/rebate-jobs.ts` — enqueue + load + mark-done.
- `lib/db/schema.ts` + `scripts/migrate-add-rebate-jobs.mjs` — `rebate_jobs`.
- `app/api/cron/reprice/route.ts` — cron drain (mirror backups cron).
- `vercel` cron schedule config — add `/api/cron/reprice` every minute (verify
  where the backups cron is scheduled).
- `app/dealer/(portal)/purchases/actions.ts` — server-side central price lookup,
  ignore submitted price.
- Dealer purchase form component(s) — read-only price fields.
- Tests alongside the above.

# Oppo Tracker — Project Status & Handoff Note

> **INSTRUCTION FOR CLAUDE:** Read this file at the start of EVERY session on this project.
> 1. Read this entire file first.
> 2. Verify pending items against actual code before starting any work.
> 3. Continue from the last incomplete item in the roadmap.
> 4. Update this file every 10 user prompts — mark completed items ✅, add new findings, refresh "Last Session Summary".

---

## What This App Is

**Oppo Tracker** (product name: Alhamd Sales Console) is a multi-tenant SaaS for OPPO smartphone
dealer management — tracking stock purchases, activations (sales), incentive calculations, customers,
warranties, and reporting. Sold as a subscription service to mobile dealers across Pakistan.

**Stack:** Next.js App Router · Drizzle ORM · PostgreSQL · TypeScript · Tailwind CSS · Recharts · Zod

**Original spec stack was Flutter + Supabase — intentionally migrated to Next.js + Drizzle.**
**Mobile delivery: PWA first (installable on Android via Chrome), then Capacitor APK wrapper.**

**Multi-tenant model:**
- One owner (Alhamd Telecom) manages all dealer tenants
- Each dealer tenant has their own users: `admin` role (Dealer Admin) + `exec` role (Sales Officer/SO)
- `OWNER_TENANT_ID` is hardcoded for the owner's pricing/policy data
- All DB queries scoped by `tenantId` + `dealerId`

---

## Three Portals

### 1. Owner Portal — `app/(app)/`
Auth: HMAC token cookie · `isAuthenticated()` · session invalidation

| Feature | Status |
|---------|--------|
| Dashboard — 8 layout views (Cards, Charts, Overview, Compact, Financial, Performance, Timeline, Executive) | ✅ |
| Activations — CRUD, bulk by qty, bulk by date, IMEI tracking | ✅ |
| Purchases — CRUD, bulk invoice, price sync to master | ✅ |
| Models — CRUD, price history, snapshot sync | ✅ |
| Dealer IDs — management | ✅ |
| Policies — management | ✅ |
| Reports — Excel export, PDF summary, PDF detailed | ✅ |
| Audit log — view, filter, purge (tenant-scoped) | ✅ |
| Inter-ID Transfers — management | ✅ |
| CR-Caught tracking | ✅ |
| Admin Panel — dealer create, renew, password reset, feature flags, backups | ✅ |
| Revenue dashboard — MRR, churn, expiring in 7/30 days | ✅ |

### 2. Dealer Portal — `app/dealer/(portal)/`
Auth: HMAC token cookie · `getDealerSession()` · 30-day expiry · role: admin \| exec

| Feature | Status |
|---------|--------|
| Login / session management | ✅ |
| Dashboard — trend charts, KPI analytics | ✅ |
| Activations — create (single + bulk by date), delete (admin role only) | ✅ |
| Purchases — create (single + bulk invoice), delete | ✅ |
| Models — read-only view | ✅ |
| Inventory — view current stock | ✅ |
| Dealer IDs — view/manage | ✅ |
| Cross-Region Transfers — create, edit, status update, delete | ✅ |
| Policies — read-only view | ✅ |
| Reports | ✅ |
| Activity Log — view own audit log, purge (tenant-scoped) | ✅ |
| Settings — change password | ✅ |
| Team management | ✅ |
| **Customer DB** — create, search, link to activation/sale | ✅ |
| **Warranty Claims** — log, track, update status | ✅ |
| **Sales Scripts** — 4 embedded scripts (see below) | ✅ |
| **POS / Sell flow** — cart → customer → log sale → PDF receipt | ✅ |
| **Low-stock alerts** — threshold per model, shown on dashboard | ✅ |

### 3. Incentive Engine — `lib/incentive-engine/`

| Component | Status |
|-----------|--------|
| Base % earnings | ✅ |
| Target bonus | ✅ |
| Activation incentive policies | ✅ |
| Dealer incentive policies | ✅ |
| Stock-in earnings | ✅ |
| Cross-region tracking | ✅ |

### 4. Mobile / PWA

| Deliverable | Status |
|-------------|--------|
| PWA manifest + icons + theme-color | ✅ (manifest done; icons need to be created manually — see below) |
| Service worker (offline shell + cache) | ✅ |
| Offline activation queue (sync on reconnect) | ⚠️ Partial — SW broadcasts `SYNC_ACTIVATIONS` message; IndexedDB queue UI not built |
| "Add to Home Screen" prompt | ✅ |
| Capacitor APK wrapper | ✅ (config + packages done; `npx cap add android` needed after Android Studio install) |

---

## 4 Sales Scripts (from original spec — must be built into dealer portal)

These are embedded in the app. SOs tap "Open Script" mid-sale. Stored in `scripts` table, seeded.

1. **Infinite Sukoon loop pitch** — persuasion script for closing hesitant buyers
2. **OPPO reciprocity reminder** — builds on relationship/loyalty angle
3. **Anti-Snake IMEI verification checklist** — step-by-step IMEI check before sale
4. **Repacked-box detection guide** — how to spot tampered/returned boxes

---

## Security Fixes Applied

### Batch 1 (commit: `4db05e1`)
| ID | Fix |
|----|-----|
| C-1 | Auth guard on all admin actions |
| C-2 | Stock check inside `db.transaction()` — create activation (owner) |
| C-3 | `updateModelPrice` wrapped in transaction |
| H-1 | `purgeAuditLog` scoped to caller's dealer IDs |
| H-2 | `switchDealerAction` auth guard |
| H-3 | Team session revocation check |
| H-4 | `updateActivationAction` stock check on date move |
| H-5 | `bulkDeletePurchasesAction` wrapped in transaction |
| H-6 | `restitchPriceHistory` wrapped in transaction |

### Batch 2 (commit: `61944da`) — Steps 1 & 2 complete
| ID | Fix |
|----|-----|
| S-1 / S-1b | `deletePurchaseAction` blocked when stock consumed (owner + dealer) |
| S-2 | `updatePurchaseAction` blocks qty reduction that would go negative |
| S-3 | `updatePurchaseAction` blocks date-forward move that unbacks activations |
| S-4 | `bulkDeletePurchasesAction` per-purchase stock check in transaction |
| S-5 | Inter-ID transfer already had stock check (already guarded) |
| S-6 | CR-caught already had stock check (already guarded) |
| CR-1 | SO can only submit for owner approval; PENDING_OWNER_APPROVAL flow + alerts |
| CR-2 | Purchases above threshold → pending_review + HIGH ALERT to owner |
| CR-3 | Dealer activation: stock re-check + inserts inside `db.transaction()` |
| H-A | Activation date window: `today - backdateDays ≤ date ≤ today` (configurable) |
| H-B | `getDealerSession()` now live-checks tenant active/grace status (React cache) |
| H-C | `deleteDealerPurchaseAction` blocked when stock consumed |
| H-D | `isCrossRegion` flag requires approved CR transfer record for that model |
| H-E | Bulk dealer activations wrapped in `db.transaction()` |
| auth | `parseDealerToken()` is async — missing `await` fixed in `getDealerSession()` |

---

## Full Completion Roadmap (in order)

### STEP 1 — Security: Stock Integrity Guards ✅ COMPLETE (commit `61944da`)
### STEP 2 — Security: SO Abuse Vectors ✅ COMPLETE (commit `61944da`)

### STEP 3 — Missing Features: Customer DB ✅ COMPLETE (commit `3e59252`)
- Schema: `customers` table (name, phone, CNIC, dealer_id, tenant_id, created_at)
- Owner portal: customer list, link to activations
- Dealer portal: create customer, search by phone/CNIC, view history
- Link activation → customer (optional FK on activations table)

### STEP 4 — Missing Features: Warranty Claims ✅ COMPLETE (commit `fb13932`)
- Schema: `warranty_claims` table (id, customer_id, activation_id, model_id, issue_desc, status, created_at, resolved_at)
- Dealer portal: log claim, update status (pending/in_repair/resolved/rejected)
- Owner portal: view all claims across dealers

### STEP 5 — Missing Features: Sales Scripts ✅ COMPLETE (commit `af87973`)
- Schema: `scripts` table (id, title, body, sort_order, is_active) — global, not tenant-scoped
- Seeded 4 scripts: Infinite Sukoon Loop, OPPO Reciprocity Reminder, Anti-Snake IMEI Checklist, Repacked-Box Detection
- Dealer portal: card grid → Sheet with full body text
- Owner portal: full CRUD with dialog editor + toggle active/inactive

### STEP 6 — Missing Features: POS / Sell Flow ✅ COMPLETE (commit `c615a2c`)
- 3-step wizard: model + IMEI → customer (skip/new) → confirm
- Stock TOCTOU-safe via `db.transaction()` with inline SQL recheck
- Creates new customer inline if name+phone provided without existing customerId
- PDF receipt via `@react-pdf/renderer` (thermal 220×360pt), download link on success
- GET route: `/api/dealer/receipt/[id]` — session-scoped, returns `application/pdf`

### STEP 7 — Missing Features: Low-Stock Alerts ✅ COMPLETE (commit `5b57beb`)
- `lowStockThreshold` (nullable integer) added to `models` table
- `LowStockBanner` — async server component, fetches own data, renders null if no alerts
- Shown above dashboard client component without modifying `DashboardData` type
- Owner: `getModelsWithThreshold()` + `setModelLowStockThreshold()` in models queries

### STEP 8 — Missing Features: Revenue Dashboard (Owner) ✅ COMPLETE (commit `a730232`)
- `monthlyFee` (nullable real) added to `dealerTenants` table
- `getRevenueSummary()` computes MRR, ARR, expiringIn7, expiringSoon, churn counts
- `RevenueClient` — `FeeEditor` inline component, status filter, color-coded expiry dates
- Owner sets monthly fee per dealer inline in the revenue table

### STEP 9 — PWA ✅ COMPLETE (commit `bde0140`)
- `public/manifest.json` — name, shortcuts (/dealer/pos, /dealer/activations), icons array
- `public/sw.js` — custom service worker: network-first navigate, cache-first static, network-only API
- `public/offline.html` — offline fallback page
- `components/pwa/sw-register.tsx` — client component registering `/sw.js`
- `components/pwa/install-prompt.tsx` — `beforeinstallprompt` floating card, sessionStorage dismissal
- ⚠️ **Manual step**: create `/public/icons/icon-192.png` and `/public/icons/icon-512.png` (green #0A6E5C, 192px and 512px)

### STEP 10 — Capacitor APK ✅ COMPLETE (commit `fae032b`)
- Packages: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/status-bar`, `@capacitor/splash-screen`
- `capacitor.config.ts` — server mode pointing to `https://app.alhamdtelecom.com`, green theme, splash screen
- Scripts: `cap:sync`, `cap:open`, `cap:build` in package.json
- ⚠️ **Manual steps**: install Android Studio → `npx cap add android` → `npm run cap:sync` → `npm run cap:open` → build signed APK

### STEP 11 — Admin: Dealer Policy Settings ✅ COMPLETE
- `app/admin/dealers/[id]/settings/page.tsx` — server page loading current `backdateDays` and `purchaseApprovalThreshold`
- `app/admin/dealers/[id]/settings/actions.ts` — `saveDealerSettingsAction` with Zod validation
- `lib/admin/dealers.ts` — `getDealerSettings()` and `updateDealerSettings()` added
- "Settings" button added to dealer detail page next to Features/Renew

### STEP 12 — Admin: Owner Alert Inbox ✅ COMPLETE
- `app/admin/alerts/page.tsx` — server page loading all alerts via `listAllOwnerAlerts()`
- `app/admin/alerts/alerts-client.tsx` — filter All/Unread, dismiss one, mark all read, optimistic UI
- `app/admin/alerts/actions.ts` — `markAlertReadAction`, `markAllReadAction` with `revalidatePath`
- `lib/db/queries/alerts.ts` — `listAllOwnerAlerts()`, `countAllUnreadAlerts()`, `markAllAlertsReadGlobal()` added
- Admin layout updated with Alerts nav item + live unread badge
- Alert types supported: `cr_pending_approval`, `purchase_pending_review`

### STEP 13 — Database Migration ✅ COMPLETE
- Generated `lib/db/migrations/0001_pink_klaw.sql` via `drizzle-kit generate`
- Applied via custom `scripts/run-migration.mjs` (pooler DDL workaround)
- New tables: `customers`, `owner_alerts`, `scripts`, `warranty_claims`
- New columns: `activations.customer_id`, `dealer_tenants.features/backdate_days/purchase_approval_threshold/monthly_fee`, `models.low_stock_threshold`, `purchases.review_status`

---

## Decisions Locked (all open questions answered 2026-05-22)

| ID | Decision |
|----|----------|
| H-A | Configurable per-dealer `backdateDays` (default 3). Owner sets it per dealer in admin panel. Rule: `today - backdateDays ≤ activationDate ≤ today`. Future dates blocked. |
| H-D | isCrossRegion requires a linked Cross-Region Transfer record for that model on or before that date. No CR record = checkbox blocked. |
| CR-2 | Purchases above a per-dealer threshold (owner-configurable) are flagged "Pending Owner Review" and excluded from incentive calculations until owner approves them. |
| CR-1 | SO can submit CR transfer application. Owner gets HIGH ALERT notification immediately. Stock does NOT move until owner approves. Owner must explicitly approve/reject before unit is removed from dealer's active stock. |

---

### STEP 14 — Owner Staff + Dealer Team + CR Fix + Bug Fixes ✅ COMPLETE (2026-05-23)

**Owner Staff (SO / Accountant roles):**
- Schema: `owner_staff` table + `rebates` table (migration `0002` applied)
- `lib/staff-auth.ts` — HMAC token session, `verifyStaffCredentials`, `startStaffSession`, `endStaffSession`, `getStaffSession`
- `app/staff/login/` — standalone login page + server action
- `app/admin/staff/` — management UI (create, reset password, toggle active, delete)
- Role-based nav: `nav-config.ts` `roles` field; `Sidebar` + `BottomNav` filter by `staffRole` prop
- `app/(app)/layout.tsx` — derives `staffRole` from session, passes to Sidebar/BottomNav; `export const dynamic = "force-dynamic"`

**Dealer 2-member team limit:**
- `lib/admin/dealers.ts` — `DEALER_TEAM_LIMIT = 2`, `addDealerTeamMember` enforces COUNT check
- `app/admin/dealers/[id]/team/` — server page + client UI + actions

**CR Transfer fix:**
- `lib/db/queries/transfers.ts` — owner can now approve `PENDING_REPORT` transfers directly (not just `PENDING_OWNER_APPROVAL`)

**Bug fixes:**
- `startStaffSession` now deletes `oppo_session` cookie atomically — fixes cross-session sidebar contamination
- `lockAction` uses dynamic import for `staff-auth` (fixes Turbopack virtual module error); staff sign-out clears `oppo_staff_session` and redirects to `/staff/login`
- `activations/data-actions.ts` uses `isAnyAuthenticated()` — SO can see activation charts and price pre-fill
- `components/pwa/sw-register.tsx` — SW only registers in production (fixes "module factory not available" in dev caused by service worker caching Turbopack dev chunks)

---

### STEP 15 — Rebate System + SO Staff Features ✅ COMPLETE (2026-05-23/24)

**Rebate system (price-drop income from OPPO):**
- `rebates` table + migration `0002` — tracks price-drop rebates per dealer per model
- `createRebatesForPriceDrop` in `lib/db/queries/rebates.ts` — auto-fires when model price drops
- Uses `getStockForModel` (correct formula: purchases − activations − transfers_out − cr_caught)
- Tenant-scoped: only creates rebates for the owner's dealer IDs
- `listRebatesForDealerInPeriod` + `sumRebatesForPeriod` — period-filtered queries

**Dashboard rebate integration:**
- `app/(app)/dashboard/actions.ts` — `DashboardPeriodResult` now includes `rebateTotal`; `getDashboardPeriodAction` fetches it in parallel
- `app/(app)/dashboard/page.tsx` — `sumRebatesForPeriod` added to server-side Promise.all; `initialRebateTotal` prop passed to `DashboardClient`
- `app/(app)/dashboard/dashboard-analytics.tsx`:
  - "Rebates receivable" KPI card in all layouts (cyan/teal color)
  - Grand Total card waterfall now includes price-drop rebates stream + net receivable line
  - Financial layout: "Receivables" section added between gross and deductions
  - Executive layout: 5th metrics card added for rebates
  - Charts/overview/compact/overview all updated with rebates
  - CSV export includes rebate + net receivable lines

**Reports visual overhaul:**
- `app/(app)/reports/reports-client.tsx` — full `ReportSection` redesign:
  - 3 hero totals at top: Gross from OPPO · Rebates Receivable (cyan) · Net Receivable
  - Income streams waterfall with color-coded bars and share %
  - Target Bonus status card (emerald/amber) with progress bar
  - OPPO ledger reconciliation in 3-column grid
  - Per-model table with rounded border, faded rows for zero-earn models
  - Price-drop rebates section with cyan border/bg + "OPPO Owes You" label
  - CR-Caught loss with red border/bg
  - Policies & achievements: per-policy cards with progress bars, CircleCheck/CircleX icons

**SO Staff features (activation deletion request):**
- SO submits deletion request → `owner_alerts` entry → owner approves/rejects from alerts inbox
- CR-Caught approval gate: SO-submitted catches need owner approval before stock deducts
- All 6 SO features complete

**Bug fixes:**
- `DEALER_TEAM_LIMIT` moved to `lib/constants.ts` to break server-only import chain in client components
- `startStaffSession` deletes `oppo_session` cookie to prevent sidebar contamination
- Turbopack virtual module errors fixed via dynamic imports

---

### STEP 16 — Rebate Accounting Rules + Delete Protection ✅ COMPLETE (2026-05-24)

**Files changed:**
- `lib/db/queries/models.ts`
- `lib/db/queries/rebates.ts`
- `app/(app)/models/actions.ts`
- `app/(app)/models/manage-sheet.tsx`

**What was done:**

1. **`deletePriceEntry` — delete linked rebates atomically**
   - When a price entry is deleted, all rebates with matching `priceHistoryId` are deleted first
   - Safe ordering: rebates deleted BEFORE price row (if rebate delete fails, price row stays intact)

2. **`deletePriceEntry` — block deletion of historical entries**
   - Only the current active entry (`effectiveTo IS NULL`) can be deleted
   - Historical entries return `{ ok: false, reason: "..." }` — cannot be deleted, only edited
   - `deletePriceEntryAction` updated to handle the typed result and surface the error as a toast

3. **Delete button hidden for historical rows in UI**
   - `manage-sheet.tsx` → `PriceRow`: delete button only renders when `row.effectiveTo === null`
   - Edit button still shows for all rows (historical entries can still be edited)

4. **`updatePriceEntry` — full rebate reconciliation on edit**
   - If the entry being edited already has linked rebates (meaning it was a prior price drop):
     - Retrieves `oldDealerPrice` from the stored rebate record (the baseline price before the drop)
     - Deletes all existing rebates for this `priceHistoryId`
     - If new price is still lower than baseline → recreates rebates with updated amounts
     - If new price is same/higher than baseline → rebates stay deleted (no drop anymore)
   - If no linked rebates and editing the current entry with a price drop → creates new rebates (existing path)

5. **Warning dialog before delete shows rebate impact**
   - `RebateRow` interface + all 3 query functions now include `priceHistoryId` field
   - Before deletion, UI filters `rebates` prop by `priceHistoryId` and shows:
     `"⚠️ WARNING: This price drop has N rebate record(s) worth PKR X. Deleting will also delete those rebates."`

6. **DB orphan cleanup (one-time)**
   - Deleted 1 orphaned rebate (PKR 3,300) — priceHistoryId pointed to deleted row
   - Deleted 1 backfill rebate (PKR 3,000 A6c, NULL priceHistoryId) — user had deleted the price drop
   - A6c now has 0 rebates ✅

---

## Last Session Summary

**Date:** 2026-05-24

**Completed this session:**
- Full rebate accounting logic: delete protection, historical entry lock, reconciliation on edit
- Warning dialog shows rebate count + PKR amount before delete
- DB cleaned: A6c orphan rebates removed
- TypeScript clean

**Git state:** `master` · latest commit `fae032b` · all Steps 11–16 uncommitted (working tree changes)

**Remaining manual steps (not in code):**
1. Create `/public/icons/icon-192.png` and `/public/icons/icon-512.png` (192px / 512px, green #0A6E5C)
2. Install Android Studio + SDK, then: `npx cap add android` → `npm run cap:sync` → `npm run cap:open` → build signed APK

**Remaining code items:** None known — all roadmap items complete.

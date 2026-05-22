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
| Revenue dashboard — MRR, churn, expiring in 7/30 days | ❌ Pending |

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
| **Customer DB** — create, search, link to activation/sale | ❌ Pending |
| **Warranty Claims** — log, track, update status | ❌ Pending |
| **Sales Scripts** — 4 embedded scripts (see below) | ❌ Pending |
| **POS / Sell flow** — cart → customer → log sale → PDF receipt | ❌ Pending |
| **Low-stock alerts** — threshold per model, shown on dashboard | ❌ Pending |

### 3. Incentive Engine — `lib/incentive-engine/`

| Component | Status |
|-----------|--------|
| Base % earnings | ✅ |
| Target bonus | ✅ |
| Activation incentive policies | ✅ |
| Dealer incentive policies | ✅ |
| Stock-in earnings | ✅ |
| Cross-region tracking | ✅ |

### 4. Mobile / PWA — NOT STARTED

| Deliverable | Status |
|-------------|--------|
| PWA manifest + icons + theme-color | ❌ Pending |
| Service worker (offline shell + cache) | ❌ Pending |
| Offline activation queue (sync on reconnect) | ❌ Pending |
| "Add to Home Screen" prompt | ❌ Pending |
| Capacitor APK wrapper | ❌ Pending (after PWA is stable) |

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

### STEP 3 — Missing Features: Customer DB ❌ NOT DONE
- Schema: `customers` table (name, phone, CNIC, dealer_id, tenant_id, created_at)
- Owner portal: customer list, link to activations
- Dealer portal: create customer, search by phone/CNIC, view history
- Link activation → customer (optional FK on activations table)

### STEP 4 — Missing Features: Warranty Claims ❌ NOT DONE
- Schema: `warranty_claims` table (id, customer_id, activation_id, model_id, issue_desc, status, created_at, resolved_at)
- Dealer portal: log claim, update status (pending/in-repair/resolved/rejected)
- Owner portal: view all claims across dealers

### STEP 5 — Missing Features: Sales Scripts ❌ NOT DONE
- Schema: `scripts` table (id, title, body, sort_order, is_active)
- Seed the 4 scripts from original spec
- Dealer portal: scripts list page, tap to open full script mid-sale
- Owner portal: CRUD to manage/update scripts

### STEP 6 — Missing Features: POS / Sell Flow ❌ NOT DONE
- New flow in dealer portal: pick model → pick/create customer → confirm → log activation + link customer → generate PDF receipt
- PDF receipt: dealer name, customer name/phone, model, IMEI, date, price, reference number
- This is separate from the existing plain activation form (keep both)

### STEP 7 — Missing Features: Low-Stock Alerts ❌ NOT DONE
- Per-model threshold setting (owner sets it, stored in model or separate table)
- Dealer portal dashboard: warning banner for models below threshold
- Owner portal: cross-dealer low-stock view

### STEP 8 — Missing Features: Revenue Dashboard (Owner) ❌ NOT DONE
- MRR (monthly recurring revenue from subscriptions)
- Expiring in 7 days / 30 days counts
- Churn (expired without renewal)
- Total active dealers / suspended / grace

### STEP 9 — PWA ❌ NOT DONE
- `public/manifest.json` with app name, icons, theme (#0A6E5C), display: standalone
- Service worker (next-pwa or custom) — cache shell, offline fallback page
- Offline activation queue — store pending activations in IndexedDB, sync on reconnect
- "Add to Home Screen" banner in dealer portal

### STEP 10 — Capacitor APK ❌ NOT DONE (after Step 9)
- Install Capacitor, configure for Android
- Build Next.js → static export or server → wrap in Capacitor
- Test on Android 8+
- Generate signed APK

---

## Decisions Locked (all open questions answered 2026-05-22)

| ID | Decision |
|----|----------|
| H-A | Configurable per-dealer `backdateDays` (default 3). Owner sets it per dealer in admin panel. Rule: `today - backdateDays ≤ activationDate ≤ today`. Future dates blocked. |
| H-D | isCrossRegion requires a linked Cross-Region Transfer record for that model on or before that date. No CR record = checkbox blocked. |
| CR-2 | Purchases above a per-dealer threshold (owner-configurable) are flagged "Pending Owner Review" and excluded from incentive calculations until owner approves them. |
| CR-1 | SO can submit CR transfer application. Owner gets HIGH ALERT notification immediately. Stock does NOT move until owner approves. Owner must explicitly approve/reject before unit is removed from dealer's active stock. |

---

## Last Session Summary

**Date:** 2026-05-22

**Work done:**
- Applied Steps 1 & 2 completely — all 14 security loopholes closed (commit `61944da`)
- Fixed critical auth bug: `parseDealerToken()` is async, was missing `await` in `getDealerSession()`
- Added schema: `backdateDays`, `purchaseApprovalThreshold` on `dealer_tenants`; `reviewStatus` on `purchases`; new `owner_alerts` table
- Migration script: `scripts/migrate-add-security-settings.mjs`
- Added `lib/db/queries/alerts.ts` with `createOwnerAlert`, `listOwnerAlerts`, `countUnreadAlerts`, `markAlertRead`
- CR-1 full flow: dealer submits → PENDING_OWNER_APPROVAL → owner approves/rejects with approve/reject buttons in UI
- Both cross-region client UIs updated with new status badge and workflow buttons

**Git state:** `master` · latest commit `61944da` · no remote configured

**Next action:** STEP 3 — Customer DB. Schema: `customers` table (name, phone, CNIC, dealer_id, tenant_id). Owner list + dealer create/search. Optional FK from activations to customers.

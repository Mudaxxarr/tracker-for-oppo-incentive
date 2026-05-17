# OPPO Dealer ID Incentive Tracker — Build Summary

## How to run

```bash
cd "C:\Users\Admin\Downloads\Claude\Oppo Ecosystem\oppo-tracker"
npm run db:migrate     # idempotent — safe to re-run
npm run db:seed        # only seeds if empty
npm run dev            # starts http://localhost:3000
```

The dev server is **already running** at http://localhost:3000. Visit `/unlock` and enter the default PIN.

| Item | Value |
| ---- | ----- |
| Local URL | http://localhost:3000 |
| Default PIN | **123456** (change immediately under Settings → Change PIN) |
| DB file | `data/oppo-tracker.db` (SQLite, WAL mode) |
| Test command | `npm test` (10 Vitest tests, all passing) |

---

## 5-step onboarding checklist

1. Open http://localhost:3000, enter PIN `123456` → land on Dashboard.
2. Go to **IDs** → confirm seeded *Khanewal Main* dealer ID. Add another ID if needed.
3. Go to **Purchases** → click *Add Purchase*, pick a model, enter qty/date, save.
4. Go to **Activations** → click *Add Activation* (or *Bulk Import*) for the same model.
5. Go to **Reports** → pick "This month", click *Generate*, verify totals, then **Export PDF** / **Export Excel**.

You'll see live dashboard KPIs animate up the moment data is added.

---

## Files created (project source — excludes node_modules)

### App routes (Next.js App Router)
- `app/layout.tsx` — root layout (fonts + theme provider + toaster)
- `app/page.tsx` — redirects to `/unlock` or `/dashboard` based on session
- `app/unlock/page.tsx` + `unlock-form.tsx` + `actions.ts` — PIN unlock flow
- `app/(app)/layout.tsx` — auth-gated shell: top bar, sidebar/bottom nav, page transitions
- `app/(app)/loading.tsx` — skeleton loader
- `app/(app)/actions.ts` — `switchDealerAction`, `lockAction`
- `app/(app)/dashboard/page.tsx` — animated KPIs, 6-month charts, top models
- `app/(app)/purchases/page.tsx` + `purchases-client.tsx` + `purchase-form.tsx` + `actions.ts`
- `app/(app)/activations/page.tsx` + `activations-client.tsx` + `activation-form.tsx` + `bulk-form.tsx` + `actions.ts`
- `app/(app)/cross-region/page.tsx` + `cross-region-client.tsx` + `actions.ts`
- `app/(app)/policies/page.tsx` + `policies-client.tsx` + `actions.ts`
- `app/(app)/reports/page.tsx` + `reports-client.tsx`
- `app/(app)/ids/page.tsx` + `ids-client.tsx` + `actions.ts`
- `app/(app)/settings/page.tsx` + `settings-client.tsx` + `actions.ts`
- `app/api/report/route.ts` — PDF + Excel export endpoint
- `app/api/backup/route.ts` — SQLite backup download

### Domain core
- `lib/incentive-engine/types.ts` — engine input/output types
- `lib/incentive-engine/index.ts` — pure `calculateIncentives()`
- `lib/incentive-engine/loader.ts` — DB → engine adapter

### Database
- `lib/db/schema.ts` — Drizzle schema (12 tables, Postgres-compatible)
- `lib/db/client.ts` — better-sqlite3 + Drizzle client
- `lib/db/migrate.ts` — programmatic migration runner
- `lib/db/seed.ts` — sample dealer + 5 OPPO models
- `lib/db/migrations/0000_…sql` — generated migration
- `lib/db/queries/models.ts`, `purchases.ts`, `activations.ts`, `policies.ts`, `transfers.ts`

### Library helpers
- `lib/auth.ts` — bcrypt PIN check, HMAC-signed session cookies
- `lib/dealer.ts` — active-dealer cookie helpers
- `lib/settings.ts` — runtime constants (base %, default bonus %)
- `lib/format.ts` — PKR currency, date, IMEI mask formatters
- `lib/constants.ts` — app-wide constants and enums
- `lib/export/report-excel.ts` — ExcelJS report builder
- `lib/export/report-pdf.tsx` — `@react-pdf/renderer` builder

### Components
- `components/feature/` — 11 app-specific feature components (top bar, sidebar, bottom nav, dealer switcher, theme toggle, lock button, page transition, KPI card, trend charts, page title, nav config)
- `components/ui/` — 13 shadcn/ui primitives (button, input, dialog, sheet, table, dropdown-menu, select, calendar, popover, tabs, card, badge, sonner)
- `components/providers.tsx` — theme provider + toaster

### Tests
- `tests/incentive-engine.test.ts` — 10 Vitest cases covering all 6 spec scenarios + edges
- `vitest.config.ts`

### Config
- `drizzle.config.ts`, `tsconfig.json`, `.env.local`, `.env.example`, `.gitignore`

---

## Dependencies

**Runtime**
`@base-ui/react`, `@hookform/resolvers`, `@react-pdf/renderer`, `bcryptjs`, `better-sqlite3`, `class-variance-authority`, `clsx`, `date-fns`, `drizzle-orm`, `exceljs`, `framer-motion`, `lucide-react`, `next` (16.2.6), `next-themes`, `react`/`react-dom` (19.2.4), `react-day-picker`, `react-hook-form`, `recharts`, `sonner`, `tailwind-merge`, `tw-animate-css`, `zod`

**Dev**
`@tailwindcss/postcss`, `@types/bcryptjs`, `@types/better-sqlite3`, `@types/node`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `drizzle-kit`, `eslint`, `eslint-config-next`, `tailwindcss`, `tsx`, `typescript`, `vitest`

---

## Spec compliance

| Spec rule | Implementation |
| --- | --- |
| Multi-dealer-ID with switcher | Top-bar `DealerSwitcher` writes `oppo_active_dealer` cookie; every query is scoped by it |
| Price snapshot on activation | `getPriceOnDate(modelId, activationDate)` — never reads "current" price for past activations |
| 4 % base + 1 % target bonus + activation + dealer + stock-in | All five branches in `calculateIncentives` |
| Cross-region phones earn 4/1/activation/dealer but **not** stock-in | Stock-in line filters `source === 'REGULAR'` only |
| Inter-ID transfer increments destination at destination's current price | `createInterIdTransfer` calls `getPriceOnDate(dest, date)` |
| Per-model price-sub-period rows in report | `priceSubperiods[]` grouped by `dealerPriceSnapshot` |
| Discrepancy field in Reports page | "OPPO ledger says ₨___" input + delta highlighter |
| PIN unlock, no multi-user | bcrypt-hashed PIN, HMAC-signed session cookie |
| PKR formatting + DD MMM YYYY everywhere | `formatPKR` + `formatDate` in `lib/format.ts` |
| Confirmation on destructive ops | Every delete uses `confirm("Delete… cannot be undone")` |

---

## Test results

```
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

Cases covered:
1. Snapshot integrity across price changes ✅
2. Target bonus boundary (target met by exactly 1 phone) ✅
3. Target bonus NOT met (1 % must be 0) ✅
4. Cross-region earns 4/1/activation/dealer but NOT stock-in ✅
5. Activation incentive `targetQty` met / not met ✅
6. Inter-ID per-dealer scoping ✅
7. Stock-in `minQty` not satisfied by cross-region quantity ✅
8. Empty input → zero totals ✅
9. Inverted period rejected ✅

---

## Known limitations / Phase-future hooks

- Inter-ID source-side decrement is logical (recorded in `inter_id_transfers`); the engine doesn't auto-create a *negative* purchase row at the source. If you want strict pool accounting at the source ID, a future enhancement would consume from the source's purchase rows.
- Restore-from-backup is not implemented (would need to close the live DB connection on Windows). Backup download works.
- Calendar policy view (Policies page) shows Live/Expired badges but not a true date-grid calendar — defer.
- The schema is Postgres-compatible (text-typed dates, ISO strings). Switch by changing the dialect in `drizzle.config.ts` and regenerating migrations.

# Session Log — 2026-07-04

## 1. Android app build

- No Java/Android tooling existed on this machine — installed JDK 17, then JDK 21 (Eclipse Temurin), Android SDK commandline-tools, platform-tools/adb via winget + sdkmanager.
- Generated the Capacitor Android native project (`npx cap add android`).
- Wired the new Incento logo into every Android launcher icon density (legacy + adaptive foreground layers). App name intentionally left as "Alhamd Sales Console" — only the icon was requested, not a rebrand.
- Fixed a build failure: `@capacitor/android`'s library module requires Java 21 specifically, regardless of the app's own target SDK — `JAVA_HOME` must point at JDK 21 when running `./gradlew.bat assembleDebug`.
- Debug APK built successfully: `android/app/build/outputs/apk/debug/app-debug.apk`.

## 2. Discovered the app had never been deployed anywhere

- `capacitor.config.ts` pointed the app at `https://app.alhamdtelecom.com` — this subdomain has no DNS record at all (confirmed via `nslookup`), so the installed APK couldn't load anything.
- Supabase only hosts the Postgres database (`POSTGRES_URL`) — it does not host the Next.js app itself.
- Deployed the app to Vercel via CLI: `vercel link` + pushed `POSTGRES_URL`/`SESSION_SECRET`/`DEALER_SESSION_SECRET`/`APP_PIN_HASH` as production env vars + `vercel deploy --prod`.
- **Live URL: `https://oppo-tracker.vercel.app`** (Vercel team `mudaxxar-3948s-projects`). GitHub auto-deploy isn't connected yet (missing a "Login Connection" on the Vercel account) — deploys are manual via `vercel deploy --prod` for now.
- Updated `capacitor.config.ts`'s default `SERVER_URL` to the new Vercel URL and rebuilt the APK.

## 3. Mobile UI bugs fixed (shipped to production)

1. **Dark mode was leaking in automatically** based on the phone's OS setting, and much of the owner/admin UI wasn't designed for dark mode (cards turned unreadable black). Forced the app to default to light theme regardless of OS setting (`components/providers.tsx`); also added `color-scheme` CSS so native date pickers render correctly.
2. **"More" bottom-sheet menu** — was a 3-column grid, changed to a vertical list, then (per follow-up feedback) changed again to open as a **right-side drawer** instead of a bottom sheet covering half the screen (`components/feature/bottom-nav.tsx`).
3. **Top bar decluttered on mobile** — the dealer switcher, theme toggle, and sign-out button were removed from the mobile top bar and moved inside the "More" side drawer instead (`components/feature/top-bar.tsx`, `components/feature/bottom-nav.tsx`, `app/(app)/layout.tsx`).

## 4. Full QA audit — frontend (`atc-frontend` skill)

Scope: Owner portal + Admin panel, all routes, on the live Vercel deployment.

| # | Severity | Issue | Plain-language impact |
|---|----------|-------|------------------------|
| 1 | Major | Page-fade transition (`components/feature/page-transition.tsx`) can get stuck mid-animation if the tab/app loses focus during a route change (app switch, screen lock, backgrounding). | Page text is left permanently washed-out/low-contrast until the user navigates again — looks broken even though the data is fine. Verified by direct code read. |
| 2 | Minor | Recharts logs a "width/height should be greater than 0" console warning on some chart-bearing pages. | Same root cause as #1 (chart measures its container mid-fade). No visible user impact by itself, just console noise. |
| 3 | Major | `app/admin/layout.tsx`'s sidebar is `hidden md:flex` with no mobile bottom-nav/drawer equivalent. | On a phone, the admin panel (Dealers/Revenue/Rollout/Alerts/Staff) has no way to navigate between sections at all — desktop-only today. Confirmed by code read; not yet re-verified on an actual mobile render. |
| — | Testing gap | Couldn't reliably render authenticated pages at a real mobile viewport in this remote-desktop environment (window resize didn't propagate; a separate emulated browser had no login session). | The 3 mobile fixes above are shipped and code-correct, but haven't been re-confirmed visually on a real phone screen yet. |

No broken images, no clipped/overlapping text outside #1, no color-contrast issues outside #1, no desktop table overflow, no React/Next error overlays found.

## 5. Full audit — backend (`atc-backend` skill)

Scope: stock formula, rebate engine, reconciliation, tenant isolation, transactions, role rules — checked against the rules documented in `CLAUDE.md`. Every finding below was independently re-verified by reading the actual code (not just the sub-agent's claim).

| # | Severity | Location | Issue | Plain-language impact |
|---|----------|----------|-------|------------------------|
| 1 | **Critical** | `app/(app)/activations/actions.ts:368` (`updateActivationAction`) | `db.transaction(...)` wraps the update, but the query function it calls (`updateActivation`) doesn't accept the transaction handle — it writes on the ambient connection, outside the transaction. | When moving an activation to a date that would oversell, the date change is already permanently saved before the "would oversell" check runs and throws. The user sees an error, but the bad data is already committed. |
| 2 | **Critical** | `app/(app)/purchases/actions.ts:348` (`bulkDeletePurchasesAction`) | Same no-op-transaction pattern. | A failure partway through a bulk delete leaves some purchases deleted and others not, with no rollback — inconsistent state. |
| 3 | ~~Major~~ Not a bug | (feature doesn't exist) | `CLAUDE.md` documents a full `/reconciliation` route + `lib/db/queries/reconciliation.ts` with variance rules. Neither exists in the repo. **Correction:** per memory, the owner deliberately removed `/reconciliation` on 2026-06-10 — `CLAUDE.md` just wasn't updated after that decision. Not a code defect, just stale documentation. |
| 4 | Major | `app/(app)/inventory/actions.ts:252-254` (`crCaughtAction`) | Status is decided purely by `isOwner`; there's no separate branch for the `accountant` role. | CLAUDE.md says accountant-caught CR should be trusted and go active immediately — instead accountants are treated like SO and forced into `pending_owner_approval`, adding unnecessary delay to legitimate entries. |
| 5 | Major | `app/(app)/cross-region/actions.ts`, `app/(app)/reports/*` | No server-side role check exists — only the nav menu hides these items per role (`so`/`accountant` in `nav-config.ts`). | Any authenticated staff member could call the underlying server action directly and bypass the SO-only / accountant-only restriction; the boundary is decorative, not enforced. |
| 6 | Minor | `lib/db/queries/alerts.ts:28,52` | `getAlertById`/`markAlertRead` take no `tenantId` filter. | Currently harmless because every caller is owner-only (who legitimately sees all tenants), but it's a landmine if ever reused from a dealer/staff-scoped surface — would leak alerts across tenants. |
| ✅ | — | Stock formula, rebate engine | Verified correct: all 4 stock components properly scoped by tenant+dealer; `getStockForModelAsOf` (`<=`) used only for guards, `getClosingStockBeforeDate` (strict `<`) used only for rebates, exactly as specified; fire-and-forget rebate re-eval pattern correct at every call site checked. | No action needed. |

**Tests:** existing suite (`tests/incentive-engine.test.ts`, 14 tests) passes unchanged. No new tests were added this pass — the critical/major findings above are structural (transaction wiring, missing routes, missing role checks) and were confirmed by direct code reading rather than new unit tests.

## 6. Fixes applied (2026-07-04, same day)

**#1 and #2 (both CRITICAL transaction-bypass bugs) fixed:**

- `lib/db/queries/activations.ts` — `updateActivation` now accepts an optional `executor` param (matching the existing pattern used by `createActivation`/`getMinForwardStock`), defaulting to the plain `db` connection but able to run inside a transaction.
- `app/(app)/activations/actions.ts` (`updateActivationAction`) — the transaction callback now captures `tx` and threads it into both `updateActivation(...)` and `getMinForwardStock(...)`. The oversell guard now genuinely rolls back the date change if it fails, instead of the change already being committed.
- `lib/db/queries/purchases.ts` — `getStockForModel` and `deletePurchase` now accept the same optional `executor` param.
- `app/(app)/purchases/actions.ts` (`bulkDeletePurchasesAction`) — threads `tx` into both calls, so the stock guard and the delete happen atomically, and each loop iteration correctly sees the previous iteration's pending delete when checking the same model's stock.
- Verified: `npx tsc --noEmit` clean, existing test suite (`tests/incentive-engine.test.ts`, 14 tests) still passing.
- Not yet deployed to Vercel — holding per user instruction, deploy only when told.

**#4 (accountant CR-caught not trusted) fixed:**

- `app/(app)/inventory/actions.ts` (`crCaughtAction`) — now checks `getStaffSession()` in addition to `isAuthenticated()`. Owner OR accountant → `isTrusted = true` → CR-caught goes `active` immediately, no owner-alert, rebates re-evaluate right away. Only SO stays at `pending_owner_approval`.
- Verified: `npx tsc --noEmit` clean, existing test suite still 14/14 passing.
- Not yet deployed — same hold as above.

**#3 (reconciliation) confirmed not a bug** — owner deliberately removed `/reconciliation` on 2026-06-10 (per memory); this is stale documentation in CLAUDE.md, not a defect. No action taken, excluded from further consideration.

**#5 (SO/accountant role checks were UI-only) fixed:**

- `app/(app)/cross-region/actions.ts` — `createCrossRegionAction` and `crOutwardAction` now call `getStaffSession()` and reject with `{ error: "Not authorized for this role" }` if the caller is an accountant (Cross-Region stays SO + owner only).
- `app/(app)/reports/page.tsx` — now redirects to `/dashboard` if the caller is SO (Reports stays accountant + owner only).
- Verified: type-check clean, 14/14 tests passing.

**#6 (alerts.ts missing tenantId filter) fixed:**

- `lib/db/queries/alerts.ts` — `getAlertById` and `markAlertRead` now both require and filter by `tenantId`.
- Updated all 11 call sites across `app/admin/alerts/actions.ts` and `app/admin/previews/actions.ts` to pass `OWNER_TENANT_ID` (the only tenantId owner alerts ever use in this single-owner architecture).
- Verified: type-check clean, 14/14 tests passing.
- Not yet deployed — same hold as above.

**Deployed to Vercel** (backend fixes #1, #2, #4, #5, #6 live at `oppo-tracker.vercel.app`).

## 7. Frontend fixes

**Page-fade stuck bug fixed:** removed the `PageTransition` (Framer Motion `AnimatePresence`) wrapper entirely from `app/(app)/layout.tsx` and `app/team/(protected)/layout.tsx` — it was purely decorative (a 200ms fade on route change) and the sole cause of pages getting stuck washed-out when the tab lost focus mid-animation. Deleted the now-unused `components/feature/page-transition.tsx`. Next.js App Router doesn't need it for correct rendering.

**Admin panel mobile navigation added:** `app/admin/layout.tsx` now has a floating mobile-only menu button (bottom-right, `md:hidden`) that opens the same `AdminNav` items (Home/Dealers/Revenue/Features/Rollout/Alerts/Staff) in a right-side drawer, matching the pattern already used for the owner portal's "More" menu. Desktop sidebar unchanged.

**Recharts console warning resolved as a side effect** — confirmed via code read that `components/feature/trend-charts.tsx` (used by Team Dashboard, the page where this warning was observed) has no animation wrapper of its own around `ResponsiveContainer`; the only source of the mid-fade zero-size measurement was the now-removed `PageTransition` wrapper in `app/team/(protected)/layout.tsx`. No separate code change needed.

Verified: type-check clean, 14/14 tests passing.

## 8. Real-device testing via adb (found after physical phone connected)

Once the phone was connected via USB, used `adb exec-out screencap` to visually inspect the actual native app (not just an emulated browser viewport) — this surfaced a bug the browser-based audit couldn't have caught.

**Renamed app label to "Incento"** (user request, since the icon was already Incento-branded but the app name still said "Alhamd Sales Console") — updated `android/app/src/main/res/values/strings.xml` (`app_name`, `title_activity_main`) and `capacitor.config.ts`'s `appName`.

**Status bar overlap bug found + fixed:** the app's own top bar (logo/branding) was rendering directly under/overlapping the phone's system status bar (clock, signal, wifi icons) — confirmed via on-device screenshot. Root cause: Android 15+ (targetSdk 35+, this project targets 36) forces edge-to-edge layout by default, and `@capacitor/status-bar@8.0.2`'s `overlaysWebView` option only toggles deprecated `View.SYSTEM_UI_FLAG_*` flags, which no longer have effect on this SDK version — so `overlaysWebView: false` in `capacitor.config.ts` was silently a no-op. A native `WindowCompat.setDecorFitsSystemWindows(window, true)` attempt in `MainActivity.java` also didn't reliably work (likely fighting the plugin's own deprecated flag calls at a different point in the activity lifecycle).

**Real fix:** moved the safe-area handling to CSS instead of fighting native/plugin timing — added `padding-top: env(safe-area-inset-top)` to the outer sticky `<header>` wrapper (with a separate inner `h-14` content row so the toolbar's own height/centering isn't affected) in all three top bars: `components/feature/top-bar.tsx` (owner + admin), `components/dealer/dealer-top-bar.tsx`, `components/feature/team-top-bar.tsx`. This works reliably because Android's WebView populates `safe-area-inset-*` based on real system-bar geometry regardless of the app's edge-to-edge/decorFitsSystemWindows state. Also fixed the admin mobile-menu floating button's bottom offset the same way (`calc(1rem + env(safe-area-inset-bottom))`) since it had the same class of bug at the bottom edge.

Verified: type-check clean, confirmed visually fixed via a fresh on-device screenshot after redeploying to Vercel and reinstalling the APK. `MainActivity.java`'s `setDecorFitsSystemWindows` call was left in place (harmless, doesn't hurt) even though the CSS fix is what actually solved it.

## 9. Full on-device visual sweep (Dashboard, Purchases, Activations, Reports, Settings, "More" drawer)

Confirmed working correctly, no issues: Dashboard, Reports (date fields already properly labeled "Start"/"End" here — good existing pattern), Settings' PIN/Constants sections, the "More" side drawer (opens from the right, dealer switcher + theme + sign-out at top, clean vertical list below — matches today's earlier fixes exactly).

**Found + fixed: unlabeled "From/To date" filters.** Purchases and Activations pages both had two blank `<input type="date">` filters with no visible label — when empty, Android's native date picker shows no placeholder hint text (unlike desktop browsers' "mm/dd/yyyy"), so the fields looked broken/empty even though tapping them correctly opened a working native date picker. Added visible "From date"/"To date" labels above each input in `app/(app)/purchases/purchases-client.tsx` and `app/(app)/activations/activations-client.tsx`, matching the labeling pattern already used on the Reports page.

**Found + fixed: dead "Download backup" button in owner Settings.** `app/api/backup/route.ts` now always returns `410 Gone` ("Database backup is now managed by Supabase") — the DB migrated from SQLite to Postgres/Supabase a while ago, but `app/(app)/settings/settings-client.tsx` still showed a "Download a copy of your SQLite database" button that silently failed when clicked. Replaced with accurate text pointing users to the Supabase dashboard, removed the dead link and now-unused imports (`Download` icon, `buttonVariants`, `cn`). Confirmed the dealer-portal equivalent (`app/api/dealer/backup/route.ts`) is NOT stale — it's a fully working live export, no change needed there.

Verified: type-check clean, 14/14 tests passing. Deployed to Vercel.

## 10. Full sweep of remaining screens (Models, Inventory, Cross-Region, Policies, IDs, Low Stock, Activity, Team View)

Clean, no issues: Inventory, Cross-Region (form), Policies (form), IDs, Low Stock, Team View dashboard (top bar clean, chart renders correctly — confirms the page-fade and status-bar fixes hold up here too).

**Found + fixed: "More" drawer (and admin's mobile menu) didn't auto-close after tapping a nav link** — user had to manually tap the backdrop to dismiss it. Made both `Sheet`s controlled (`open`/`onOpenChange` state) and close automatically whenever `pathname` changes, in `components/feature/bottom-nav.tsx`. For the admin panel, extracted the mobile menu into a new client component `components/admin/admin-mobile-nav.tsx` (since `app/admin/layout.tsx` is a server component and can't hold `useState` itself) with the same auto-close behavior, and simplified `app/admin/layout.tsx` to just render `<AdminMobileNav items={navItems} />`.

**Found + fixed: same unlabeled "From/To date" filters also on the Activity Log page** — added visible labels in `app/(app)/activity/activity-client.tsx`, matching the fix already applied to Purchases/Activations.

**Found + fixed: data tables have no horizontal-scroll hint.** Models/Cross-Region/Policies/IDs tables all have more columns than fit on a phone screen — scrolling sideways works, but nothing indicated it was possible. Added a subtle right-edge fade gradient (mobile-only) directly in the shared `components/ui/table.tsx` wrapper, so every table in the app gets the hint from one change.

**Found + fixed: Inventory's search/sort/view-toggle row got cramped on mobile**, clipping the "Search models…" placeholder — the row packed a flexible search input + a fixed-width sort dropdown + 3 view-toggle buttons into one line with no wrapping. Changed `app/(app)/inventory/inventory-client.tsx`'s row to `flex flex-wrap` with a `min-w-[200px]` floor on the search input so it drops to its own line on narrow screens instead of getting squeezed.

Verified: type-check clean, 14/14 tests passing.

## Next step

Everything found across both the browser-based audit and the full on-device sweep is now fixed: all 5 backend bugs, all frontend/UI bugs (page-fade, Recharts warning, admin mobile nav, status-bar overlap, unlabeled date filters on 3 pages, dead backup button, drawer auto-close, table scroll hint, Inventory toolbar wrapping). App renamed to "Incento" natively. Deploying this batch to Vercel now.

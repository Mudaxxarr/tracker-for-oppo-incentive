# Session checkpoint - 2026-07-13

## Current state

- Branch: `master`
- Latest implementation commit: `f47b160 fix(rebates): remove adjustments with deleted price entries`
- Stable production URL: `https://oppo-tracker.vercel.app`
- Production deployment: `dpl_htir1jsc89QUzvWGXYq6wMhHaa86`
- Deployment URL: `https://oppo-tracker-i5henzc8i-mudaxxar-3948s-projects.vercel.app`
- Verified preview: `https://oppo-tracker-dw95hb8q7-mudaxxar-3948s-projects.vercel.app`
- No git push was performed in this session.

## Central price auto-adjust feature

- Owner price changes enqueue cross-tenant dealer rebate recalculation jobs.
- The mutation path uses Next.js `after()` as the immediate background fast path.
- `/api/cron/reprice` drains missed jobs as a safety net.
- Dealer purchase prices now come from the owner-controlled central price and are read-only in the dealer purchase form.
- Eligible historical stock shows its calculated price-drop rebate/net payout.

## Cross-tenant rebate visibility fix

- Production diagnosis found that the queue correctly calculated non-owner dealer rebates but stored those rows under tenant `owner`.
- Dealer dashboards filter rebates by the dealer's own tenant, so the calculated rows existed but were invisible in dealer payout totals.
- `reEvaluateRebatesForDealer` now keeps owner price history separate from the dealer data tenant and stores/deletes rebate rows under the dealer tenant.
- The isolated integration check now queries the rebate through the non-owner dealer tenant; it failed before the fix and passed afterward.
- One-time production repair moved 2 existing rows, totaling Rs 50,000, into the correct dealer tenants:
  - 24 eligible units: Rs 48,000
  - 1 eligible unit: Rs 2,000
- The repair was atomic, saved an audit entry with action `rebate.tenant_repair`, and left 0 tenant-mismatched rebate rows.

## Deleted price-entry orphan rebate fix

- Atta's July mobile dashboard was not serving a stale value: the database still contained Rs 12,000 of rebate rows for owner price-history entries that had already been deleted.
- `deletePriceEntry` previously deleted rebates only where `rebates.tenantId` matched the owner tenant. Cross-tenant dealer rebates are stored under each dealer tenant, so those rows survived when an owner removed or reverted a test price entry.
- Price-entry deletion now removes every rebate anchored to that shared `priceHistoryId`, across all dealer tenants, before deleting the price-history row.
- The isolated integration check now creates a non-owner dealer rebate, deletes its owner price entry, drains the queue, and asserts that the dealer rebate is also removed. This assertion failed before the fix and passed afterward.
- A one-time atomic production repair removed 8 definitively orphaned rows totaling Rs 308,200, recorded audit action `rebate.orphan_cleanup`, and verified that 0 orphan rows remain.
- Atta's three orphan rows were Rs 2,000, Rs 10,000, and Rs 4,900. After cleanup, Atta's July rebate total is Rs 0.

## Cron registration

- `CRON_SECRET` is configured as an encrypted Sensitive Production environment variable. Do not write its value into this file or git.
- Production inspection confirms this registered cron:

  ```json
  { "path": "/api/cron/reprice", "schedule": "0 0 * * *" }
  ```

- `GET /api/cron/reprice` accepts Vercel's `Authorization: Bearer $CRON_SECRET` request.
- `POST /api/cron/reprice` still accepts `x-cron-secret` for a manual/external scheduler.
- The Vercel account is on Hobby, which rejected the original `*/2 * * * *` schedule. The committed/registered schedule is therefore daily at 00:00 UTC.
- This daily job is only a safety net; the normal `after()` path recalculates within seconds. A missed fast-path job may wait up to 24 hours on the Hobby schedule.
- If the account moves to Pro, or an authenticated external scheduler becomes available, change the safety-net cadence back to every two minutes.

## Verification completed

- `npm test`: 6 files, 44/44 tests passed.
- `npx tsc --noEmit`: passed.
- Targeted lint for the central-price/rebate/cron changes: passed.
- Production Vercel deployment: Ready; cron metadata confirmed with `vercel inspect`.
- Rebate tenant fix preview and production deployments: Ready.
- Isolated database integration probe:
  - Created temporary `zz_test_cpa_*` records.
  - Confirmed non-owner rebate `100 = 5 x 20`.
  - Confirmed deleting the owner price-history entry also removes the dealer-tenant rebate.
  - Cleaned all temporary records in `finally`.
- Authenticated Playwright spot-check with an isolated dealer fixture:
  - Dashboard displayed `Your net payout Rs 3,000` and `Price-drop refund Rs 3,000`.
  - Purchase form displayed dealer price `67500` and invoice price `69999`.
  - Both price inputs had `readOnly=true` and `tabIndex=-1`.
  - Browser console had 0 errors and 0 warnings.
  - The temporary fixture, auth state, and helper script were removed after the check.
- Evidence screenshots:
  - `output/playwright/central-price-spotcheck/.playwright-cli/page-2026-07-13T12-33-14-856Z.png`
  - `output/playwright/central-price-spotcheck/.playwright-cli/page-2026-07-13T12-34-08-554Z.png`
- Real affected-dealer production verification:
  - Khan Mobiles Ayyub Road displayed `Oppo A6c 4/64` at Rs 39,000 per unit with 24 units.
  - Dashboard displayed `Price-drop refund Rs 48,000` and `Your net payout Rs 54,800` for July 2026.
  - Browser console had 0 errors and 0 warnings.
  - Temporary authentication state and helper/repair scripts were deleted.
  - Evidence: `output/playwright/real-rebate-fix/.playwright-cli/page-2026-07-13T13-34-03-266Z.png`
- Real Atta production mobile verification after orphan cleanup:
  - July 2026 displayed `Price-drop refund Rs 0` and `Your net payout Rs 2,540`.
  - The current `Oppo A6c 4/64` stock price displayed Rs 41,000 per unit.
  - Browser console had 0 errors and 0 warnings.
  - Temporary authentication state and helper/repair scripts were deleted.
  - Evidence: `output/playwright/atta-orphan-fix/.playwright-cli/page-2026-07-13T17-04-19-664Z.png`

## Known baseline issue

- Full-repository lint is not clean: 56 errors and 358 warnings remain, mostly in existing `.agents`/`.claude` skill assets and older React purity/effect findings. This did not block TypeScript, tests, targeted lint, Vercel build, or the live browser verification.

## Preserve these unrelated in-progress changes

The working tree already contains Manager APK/admin-preview work. It was intentionally included in the deployed workspace so the existing `/manager` flow would not disappear, but it is not part of the central-price commits. Do not discard or overwrite it:

```text
app/api/admin/impersonate/[id]/route.ts
app/dealer/(portal)/layout.tsx
app/dealer/actions-admin.ts
app/login/actions.ts
app/login/login-form.tsx
app/login/page.tsx
components/dealer/admin-preview-banner.tsx
lib/constants.ts
package.json
apk-download/
app/manager/
artifacts/
lib/admin/manager.test.ts
lib/admin/manager.ts
manager-app/
output/
scripts/build-manager-apk.mjs
```

## Recommended next action

Review and commit the Manager APK/admin-preview changes separately. Push `f47b160` from `master` when repository synchronization is desired; the rebate fix and production deployment are already complete.

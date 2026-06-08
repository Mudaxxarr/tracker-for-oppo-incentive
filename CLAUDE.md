\# OPPO TRACKER / ALHAMD SALES CONSOLE — CLAUDE CODE RULES



You are working on a multi-tenant OPPO dealer SaaS for Pakistan.



PRIMARY GOAL:

Use the lowest possible tokens while protecting financial accuracy.



DEFAULT BEHAVIOR:

\- Do NOT scan the full repo

\- Do NOT rewrite full files

\- Do NOT explain unless asked

\- Do NOT refactor unrelated code

\- Do NOT change schema unless requested

\- Return minimal diff only

\- Touch only requested files

\- Keep output under 120 lines

\- Prefer existing patterns



STACK:

\- Next.js App Router v16.2.6

\- TypeScript

\- PostgreSQL

\- Drizzle ORM

\- Tailwind CSS

\- shadcn/ui

\- Recharts

\- Zod

\- HMAC cookie auth

\- PWA + Capacitor Android



PORTALS:

\- Owner Portal: app/(app)/

\- Dealer Portal: app/dealer/(portal)/

\- Staff Login: app/staff/

\- Admin Panel: app/admin/



AUTH COOKIES:

\- oppo\_session = owner

\- oppo\_staff\_session = staff so/accountant

\- dealer\_session = dealer admin/exec

\- oppo\_team\_session = team

\- dealer\_active\_id = active owner dealer ID



MULTI-TENANT RULES:

\- Always scope DB queries by tenantId

\- Use dealerId where required

\- OWNER\_TENANT\_ID is for owner pricing/policy data

\- Never leak data across tenants



ROLE RULES:

\- Owner has full access

\- Accountant can access reconciliation/reports

\- SO cannot access reconciliation

\- Dealer admin can delete/manage

\- Dealer exec has limited access

\- Never weaken role checks



CRITICAL STOCK FORMULA:

Stock =

&#x20; SUM(purchases.quantity)

&#x20; - COUNT(activations)

&#x20; - SUM(interIdTransfers.quantity where fromDealerId = dealerId and status != REJECTED)

&#x20; - SUM(crCaught.quantity where status != "pending\_owner\_approval")



Inbound accepted transfers are purchases.

Do not double-count inbound transfers.



REBATE RULES:

\- Rebate triggers only on dealer price drop

\- rebatePerUnit = oldDealerPrice - newDealerPrice

\- eligibleQty = closing stock BEFORE rebate date

\- Rebate boundary must use strict `<`

\- Use getClosingStockBeforeDate for rebates

\- Do NOT use getStockForModelAsOf for rebates

\- getStockForModelAsOf uses `<=` and is only for stock guards



REBATE RE-EVAL RULE:

After activation/purchase/CR changes, call:

reEvaluateRebatesForDealer(tenantId, dealerId, modelId, triggerDate)



Pattern:

\- fire after commit

\- fire-and-forget with .catch

\- rebate failure must not rollback successful write



RECONCILIATION RULES:

Route: /reconciliation

Access: owner + accountant only



Variance:

variance = SO\_Portal\_Stock - Expected\_Closing\_Stock



variance = 0 → reconciled

variance > 0 → log inward CR as purchase source CROSS\_REGION\_TRANSFER\_IN

variance < 0 → flag CR caught as status active



Accountant CR caught is trusted and directly active.



LOCKED DECISIONS:

\- backdateDays controls activation date range

\- future activations blocked

\- isCrossRegion requires linked CR transfer

\- large purchases may be pending owner review

\- pending purchase review excluded from incentives

\- SO CR transfer does not move stock until owner approval

\- rebate eligibility uses strict midnight boundary



KEY FILES:

\- lib/db/schema.ts

\- lib/db/queries/purchases.ts

\- lib/db/queries/rebates.ts

\- lib/db/queries/cr-caught.ts

\- lib/db/queries/reconciliation.ts

\- lib/incentive-engine/

\- lib/auth.ts

\- lib/staff-auth.ts

\- lib/dealer-auth.ts

\- lib/dealer.ts

\- lib/constants.ts

\- components/feature/nav-config.ts



INCENTIVE ENGINE:

\- Keep calculations centralized in lib/incentive-engine/

\- Do not duplicate formulas in UI

\- Do not calculate financial totals on client if server helper exists

\- Accuracy over UI polish



DATABASE RULES:

Use transactions for:

\- stock-changing writes

\- activation create/update/delete

\- purchase create/update/delete

\- transfer approval/rejection

\- CR caught actions

\- reconciliation actions



Never validate stock outside the transaction when the same action mutates stock.



UI RULES:

\- Use existing shadcn/ui components

\- Use existing layout patterns

\- Avoid new components unless requested

\- Mobile/PWA behavior must remain intact

\- Do not break Capacitor compatibility



OUTPUT FORMAT:

Always respond as:



Changed files:

\- path



Diff:

```diff

...


# Alhamd Tracker — Technical Blueprint

---

## 1. Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js App Router (TypeScript strict) |
| Auth | HMAC SHA-256 token cookie (`oppo_session` / `oppo_staff_session` / `oppo_dealer_session`) |
| DB ORM | Drizzle ORM + `drizzle-orm/node-postgres` |
| DB | PostgreSQL (Supabase pooler, port 6543) |
| Validation | Zod (all server action inputs) |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| PDF | `@react-pdf/renderer` (receipts) + `exceljs` (Excel export) |
| Mobile | PWA (`/public/manifest.json` + `/public/sw.js`) + Capacitor APK wrapper |
| Mutations | Next.js Server Actions (`"use server"`) + `useActionState` |

---

## 2. Schema

### Core tenancy

```
dealer_tenants          id:text PK, businessName, ownerEmail, planMonths:int, startedAt, expiresAt
                        status:'active'|'grace'|'expired'|'suspended'
                        backdateDays:int=3, purchaseApprovalThreshold:int?, monthlyFee:real?

dealer_ids              id:text PK, tenantId→dealer_tenants, name, isActive:bool

models                  id:text PK, name(unique), sku?, isActive:bool, lowStockThreshold:int?

model_price_history     id:text PK, tenantId→dealer_tenants, modelId→models
                        dealerPrice:real, invoicePrice:real
                        effectiveFrom:date, effectiveTo:date?   ← NULL = current
```

### Ledger

```
purchases               id:text PK, tenantId, dealerId, modelId
                        quantity:int, unitDealerPrice:real, unitInvoicePrice:real
                        purchaseDate:date
                        source:'REGULAR'|'CROSS_REGION_TRANSFER_IN'
                        reviewStatus:'active'|'pending_review'|'approved'
                        crossRegionTransferId:text?, referenceNote:text?

activations             id:text PK, tenantId, dealerId, modelId
                        purchaseId→purchases?, imei:text(unique)?, activationDate:date
                        dealerPriceSnapshot:real, isCrossRegion:bool=false
                        customerId→customers?

rebates                 id:text PK, tenantId, dealerId, modelId
                        oldDealerPrice:real, newDealerPrice:real, rebatePerUnit:real
                        eligibleQty:int, totalRebateAmount:real
                        rebateDate:date, priceHistoryId:text?   ← links to model_price_history.id
```

### Transfers

```
cross_region_transfers  id:text PK, tenantId, dealerId, modelId, quantity:int
                        reportedDate:date, shiftedToIdDate:date?
                        status:'PENDING_REPORT'|'PENDING_OWNER_APPROVAL'|'APPROVED'|'REJECTED'

inter_id_transfers      id:text PK, tenantId, fromDealerId, toDealerId, modelId
                        quantity:int, transferDate:date, note:text?
                        status:'PENDING'|'ACCEPTED'|'REJECTED'  default='ACCEPTED'

cr_caught               id:text PK, tenantId, dealerId, modelId, quantity:int
                        caughtDate:date, dealerPriceSnapshot:real, note:text?
                        status:'active'|'pending_owner_approval'
```

### Incentive policies

```
target_bonus_policies   id, tenantId, dealerId, periodStart, periodEnd
                        targetActivationsQty:int, bonusPercent:real=1

stock_in_policies       id, tenantId, dealerId, modelId, periodStart, periodEnd
                        perUnitAmount:real, minQty:int?

activation_incentive_policies  id, tenantId, dealerId, modelId, periodStart, periodEnd
                               perUnitAmount:real, targetQty:int?

dealer_incentive_policies      id, tenantId, dealerId, modelId?, planId:text?
                               periodStart, periodEnd
                               targetTotalActivations:int, perUnitAmount:real
```

### Support tables

```
customers           id, tenantId, dealerId, name, phone, cnic?
warranty_claims     id, tenantId, dealerId, customerId?, activationId?, modelId
                    issueDesc, status:'pending'|'in_repair'|'resolved'|'rejected'
scripts             id, title, body, sortOrder:int, isActive:bool   ← global, owner-managed
owner_alerts        id, tenantId, type, entityType, entityId, dealerId?, message, isRead:bool
owner_staff         id, username(unique), passwordHash, role:'so'|'accountant', isActive:bool
audit_log           id, action, dealerId?, entityType?, entityId?, status, payload:json?, summary
dealer_daily_backups id, tenantId, backupDate:date(unique/tenant), data:json
```

---

## 3. Core Logic

### Inventory (stock ledger formula)

```
net_stock(model, dealer, date) =
  SUM(purchases.quantity WHERE purchaseDate ≤ date)
  + SUM(inter_id_transfers.quantity WHERE toDealerId=dealer AND status=ACCEPTED AND transferDate ≤ date)
  − SUM(activations WHERE activationDate ≤ date)
  − SUM(inter_id_transfers.quantity WHERE fromDealerId=dealer AND status≠REJECTED AND transferDate ≤ date)
  − SUM(cr_caught.quantity WHERE caughtDate ≤ date AND status=active)
```

Time-machine (asOf): same formula, all date columns filtered `≤ asOfDate`.

### Incentive engine — earning per activation

```
base_earned       = dealerPriceSnapshot × (baseIncentivePercent / 100)   // e.g. 4%
bonus_earned      = dealerPriceSnapshot × (bonusPercent / 100)  IF tbp eligible  // e.g. 1%
activation_earned = policy.perUnitAmount  IF AIP fires (per-model, per-period target gate)
dealer_inc_earned = policy.perUnitAmount  IF DIP eligible (global gate; see Rule B)

row_total = base + bonus + activation + dealer_inc + stock_in
```

### Target Bonus (TB) gate

```
ELIGIBLE = SUM(purchases.quantity WHERE source=REGULAR AND purchaseDate IN [tbp.periodStart, tbp.periodEnd])
           >= tbp.targetActivationsQty
→ applies 1% retroactively to ALL activations in report period
```

### Dealer Incentive (DIP) — Rule B (global gate)

```
actualTotal = COUNT(activations WHERE activationDate IN [dip.periodStart, dip.periodEnd])
             // ALL models, not model-specific

Standalone (planId=null): eligible = actualTotal >= targetTotalActivations
Plan group (shared planId):
  sharedTarget = MIN(targetTotalActivations across plan rows)
  eligible     = actualTotal >= sharedTarget  // same flag for all rows in plan
  → unlocks per-unit earnings for EACH model row in the plan simultaneously
```

### Rebate chronology

```
Trigger: when model price drops (newDealerPrice < current dealerPrice)
  → for each dealer with stock of that model:

  eligibleQty = purchases.qty − activations.qty − inter_id_out.qty − cr_caught.qty
                (as of rebateDate = price drop effectiveFrom)

  rebatePerUnit    = oldDealerPrice − newDealerPrice
  totalRebate      = eligibleQty × rebatePerUnit
  priceHistoryId   = new price entry id  ← atomic link for cleanup

On price entry EDIT (historical):
  1. Delete rebates WHERE priceHistoryId = edited entry
  2. If newDealerPrice still < oldDealerPrice → recreate rebates with updated amounts
  3. If newDealerPrice >= oldDealerPrice → rebates stay deleted

On price entry DELETE:
  Only allowed if effectiveTo IS NULL (current entry)
  Rebates deleted BEFORE price row (safe ordering)
```

### Stock-In (SIP) earnings

```
effectiveQty = SUM(REGULAR purchases in sip window) − SUM(inter_id_out in sip window)
stockInEarned = effectiveQty × perUnitAmount  IF effectiveQty >= (minQty ?? 0) AND effectiveQty > 0
```

### CR risk flag

```
isCrossRegion = true  requires approved CR transfer record for that model, on or before activationDate
CR-caught status = 'pending_owner_approval' when submitted by SO (stock NOT deducted until owner approves)
```

---

## 4. Roles

### Auth sessions

| Session cookie | Who | Scope |
|----------------|-----|-------|
| `oppo_session` | Owner (admin) | Full owner portal |
| `oppo_staff_session` | Owner staff (SO / Accountant) | Owner portal (filtered nav) |
| `oppo_dealer_session` | Dealer admin or exec | Dealer portal |

### Owner vs Owner Staff

| Capability | Owner (admin) | SO | Accountant |
|------------|---------------|----|------------|
| All CRUD (models, policies, purchases, activations) | ✅ | read-only | read-only |
| Approve CR caught | ✅ | ✗ | ✗ |
| Approve purchase reviews | ✅ | ✗ | ✗ |
| Approve activation deletion requests | ✅ | ✗ | ✗ |
| View reports / incentive engine | ✅ | ✅ | ✅ |
| View activation charts / price pre-fill | ✅ | ✅ | ✅ |
| Submit CR-caught (via dealer portal) | n/a | ✅ (pending approval) | ✗ |
| Dealer management (admin panel) | ✅ | ✗ | ✗ |
| Staff management | ✅ | ✗ | ✗ |

### Dealer admin vs exec (SO)

| Capability | Dealer admin | Exec (SO) |
|------------|--------------|-----------|
| Create activations / purchases | ✅ | ✅ |
| Delete own records | ✅ | request only (owner approves) |
| View all history | ✅ | ✅ |
| Team management | ✅ | ✗ |
| CR Transfer submit | ✅ | ✅ (pending owner approval) |
| POS / sell flow | ✅ | ✅ |
| Password change | ✅ | ✅ (own only) |

---

## 5. Data Flow — IMEI Lifecycle

```
[Purchase Entry]
  purchases row: modelId, qty, unitDealerPrice, source=REGULAR
  → stock ledger +qty
  → IF qty > purchaseApprovalThreshold → reviewStatus=pending_review + HIGH ALERT to owner

[Cross-Region Arrival]
  cross_region_transfers: status=APPROVED by owner
  → purchases row: source=CROSS_REGION_TRANSFER_IN (auto-created by approval action)
  → stock ledger +qty (CR bucket, not REGULAR)

[Inter-ID Transfer OUT]
  inter_id_transfers: fromDealerId, status=PENDING
  → stock ledger −qty immediately (PENDING counts as committed)
  → receiving dealer: +qty only on ACCEPTED

[Activation / IMEI Sale]
  Pre-check: getStockForModelAsOf(date) >= qty (inside db.transaction)
  activations row: imei(unique), dealerPriceSnapshot (snapped at activationDate)
  customerId? linked
  isCrossRegion: requires CR transfer record ≤ activationDate
  → stock ledger −1 per row
  → incentive engine uses dealerPriceSnapshot (not live price) for earning calc

[CR Caught (stock loss)]
  cr_caught row: status=active (owner) or pending_owner_approval (SO)
  → stock ledger −qty (only when status=active)
  → pending: HIGH ALERT, owner must approve → stock deducts on approval

[Price Drop → Rebate]
  model_price_history: new row with lower dealerPrice
  → createRebatesForPriceDrop: compute eligibleQty via ledger formula
  → rebates row per dealer: totalRebateAmount = eligibleQty × (oldPrice − newPrice)
  → priceHistoryId links rebate ↔ price row for atomic cascade

[Incentive Engine → Receivable Ledger]
  calculateIncentives(input: EngineInput): IncentiveReport  ← pure function, no DB
  Input: activations[], purchases[], policies (all 4 types), models[]
  Output: per-model rows { baseEarned, bonusEarned, activationEarned, dealerIncEarned, stockInEarned }
  Dashboard / Reports read this report to show grand total receivable
  Rebate total added separately: sumRebatesForPeriod(tenantId, dealerId, start, end)
  Net receivable = grandTotal + rebateTotal − CR_caught_loss
```

---

## Migration state

| File | Status |
|------|--------|
| `0000_initial.sql` | Applied + tracked in Drizzle journal |
| `0001_pink_klaw.sql` | Applied manually (not in journal) |
| `0002_rebates_staff.sql` | Applied manually (not in journal) |
| `0003_cr_caught_status.sql` | Applied manually (not in journal) |
| `0004_dip_planid.sql` | Applied via `scripts/apply-migration.mts` |

> **Important:** Drizzle migrator journal only tracks `0000`. All future migrations must be applied via direct SQL script (`npx tsx --env-file=.env.local scripts/apply-migration.mts`), not `npm run db:migrate`.

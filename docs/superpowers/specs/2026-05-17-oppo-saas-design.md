# OPPO Tracker → Multi-Tenant SaaS Design Spec
**Date:** 2026-05-17  
**Status:** Approved  

---

## 1. Scope

Extend the existing OPPO Tracker (Next.js 16.2.6 / SQLite / single-owner) into a multi-tenant SaaS with four additions:

1. **Phase 1** — Migrate SQLite → Supabase Postgres (Drizzle ORM, `pg` driver)
2. **Phase 2** — Dealer account system + subscription gating
3. **Phase 3** — Owner super-admin panel (`/admin/*`)
4. **Phase 4** — PWA install + mobile-responsive UI + animation polish
5. **Phase 5** — Exec role restricted mobile dashboard

Nothing is rebuilt. All existing owner flows (`/unlock`, `/team`, `/(app)`) are untouched.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  /unlock → owner PIN → /(app)/* + /admin/*                  │
│  /dealer/login → dealer email+pass → /dealer/*              │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
       middleware.ts                middleware.ts
   (verifies oppo_session)    (verifies dealer_session,
    → allow / redirect /unlock   checks subscription,
                                  sets X-Grace header)
               │                          │
               ▼                          ▼
        Supabase Postgres (pg Pool via POSTGRES_URL)
              Drizzle ORM
```

### Tenant model
- Each dealer organization = one `dealer_tenants` row (`id`, `status`, `expires_at`)
- Each human login = one `dealer_users` row (`tenant_id FK`, `role: admin|exec`)
- All existing data tables (`dealer_ids`, `purchases`, `activations`, etc.) gain `tenant_id` FK
- `models`, `app_settings`, `audit_log` stay global (no `tenant_id`)
- The owner gets a seed row `dealer_tenants(id='owner')` for backfill of existing data

---

## 3. Stack Decisions (locked)

| Concern | Decision |
|---|---|
| Framework | Next.js 16.2.6 App Router — no change |
| DB driver | Replace `better-sqlite3` with `pg` Pool |
| ORM | Drizzle ORM — no change |
| Cloud DB | Supabase Postgres via `POSTGRES_URL` (pooler endpoint, port 6543) |
| Supabase client | None — raw `pg` only, no `@supabase/supabase-js` |
| PWA | `@ducanh2912/next-pwa` (maintained fork of `next-pwa`, identical API, supports Next.js 15+) |
| New packages | `pg`, `@types/pg`, `@ducanh2912/next-pwa` only |
| Owner auth | Existing PIN/HMAC at `/unlock` — zero changes |
| Dealer auth | New email+password at `/dealer/login` using extended HMAC session |

---

## 4. Schema Changes

### New tables

```typescript
// dealer_tenants — one row per dealer organization
export const dealerTenants = pgTable("dealer_tenants", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  ownerEmail: text("owner_email").notNull().unique(),
  planMonths: integer("plan_months").notNull(),
  startedAt: text("started_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  status: text("status").notNull(), // 'active'|'grace'|'expired'|'suspended'
  createdAt: isoDateTime("created_at").notNull(),
});

// dealer_users — login credentials per tenant
export const dealerUsers = pgTable("dealer_users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => dealerTenants.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // 'admin'|'exec'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: isoDateTime("created_at").notNull(),
});
```

### Existing table changes

All tenant-scoped tables gain:
```typescript
tenantId: text("tenant_id").notNull().references(() => dealerTenants.id)
```
Tables: `dealer_ids`, `purchases`, `activations`, `cross_region_transfers`, `inter_id_transfers`, `cr_caught`, `target_bonus_policies`, `stock_in_policies`, `activation_incentive_policies`, `dealer_incentive_policies`, `model_price_history`

Backfill: seed row `dealer_tenants(id='owner')` first, then `UPDATE <table> SET tenant_id = 'owner'` for all existing rows.

### Postgres fixes to schema.ts

| Old (SQLite) | New (Postgres) |
|---|---|
| `sqliteTable` | `pgTable` |
| `integer("x", {mode:"boolean"})` | `boolean("x")` |
| `sql\`(strftime(...))\`` | `sql\`(now()::text)\`` |
| `integer`, `real` | `integer`, `real` (Drizzle pg equivalents) |

---

## 5. Dealer Session Token

Extended HMAC token (stateless — no DB lookup per request):

```
payload = issued.tenantId.userId.role.random
token   = payload + "." + HMAC-SHA256(DEALER_SESSION_SECRET, payload)
```

Cookie name: `dealer_session`. TTL: 30 days. HttpOnly, SameSite=lax.

`getDealerSession()` in middleware verifies sig + age, returns `{tenantId, userId, role}` without any DB call. Subscription check (one DB call) happens after token verification.

---

## 6. Middleware

`middleware.ts` at project root handles two path groups:

```
/dealer/login, /dealer/expired  → public (no auth check)
/dealer/*                       → verify dealer_session
                                  → check subscription(tenantId)
                                     active/grace → allow (grace sets X-Grace:true header)
                                     expired/suspended → redirect /dealer/expired
/admin/*                        → verify owner oppo_session → allow / redirect /unlock
```

The existing `/(app)/*` auth check remains in `app/(app)/layout.tsx` (layout-level, not middleware).

---

## 7. Admin Panel Routes

All under `app/admin/` — protected by existing `isAuthenticated()`.

| Route | Purpose |
|---|---|
| `/admin/dealers` | Table: all tenants, status badges, days remaining, actions |
| `/admin/dealers/new` | Form: create tenant + admin user; show credentials modal |
| `/admin/dealers/[id]` | Read-only KPI dashboard using existing query functions |
| `/admin/dealers/[id]/renew` | Extend subscription N months |
| `/admin/revenue` | Summary cards: active/expiring/suspended counts |

Credentials modal on `/admin/dealers/new`: shows generated temp password + `mailto:` link. No SMTP.

---

## 8. PWA Setup

- Package: `@ducanh2912/next-pwa` — `withPWA({dest:'public', register:true, skipWaiting:true})`
- `public/manifest.json`: name "Alhamd OPPO Tracker", short_name "OPPO Tracker", theme `#0A6E5C`
- Icons: 192×192 and 512×512 — static placeholder PNGs committed to `public/icons/`. (`sharp` is a transitive Next.js dep and can generate them via a one-off script if needed, but no new package required.)
- `app/layout.tsx`: `<link rel="manifest">`, `<meta name="theme-color">`
- `AddToHomeScreen` banner component: dismissible, persisted in localStorage

---

## 9. Mobile UI Fixes

- Data tables → card list on `<768px`
- Forms → single-column full-width on mobile
- All interactive elements → `min-h-[44px]`
- Sidebar hidden mobile (bottom nav already exists — verify working)
- Top bar compact on mobile (hide text labels, keep icons)

---

## 10. Animation Spec

All durations capped at 220ms.

| Element | Animation |
|---|---|
| Page transitions | `AnimatePresence` + opacity 0→1 + y 8→0, 0.18s ease-out |
| List rows | staggerChildren 0.035s, y:6→0 + opacity, 0.14s each |
| KPI cards | scale 0.97→1 + opacity, spring {stiffness:320, damping:28} |
| Bottom nav indicator | `layoutId="tab-indicator"`, spring {stiffness:400, damping:30} |
| Sheet/dialog | y:16→0 + opacity, 0.2s |

---

## 11. Exec Role (Phase 5)

Dealer users with `role='exec'`:
- Nav: 3 tabs only (Dashboard, Activations, Inventory)
- Dashboard: simplified — today count, month total, dealer name
- Activations: add allowed; delete blocked server-side (role check in server action)
- Inventory: read-only
- All other routes → redirect `/dealer/dashboard`

---

## 12. Migration Strategy

1. Archive existing SQLite migrations: move `lib/db/migrations/` → `lib/db/migrations-sqlite-archive/`
2. Update `drizzle.config.ts` to `dialect: 'postgresql'`
3. Update `lib/db/client.ts` to `pg Pool` + Drizzle node-postgres
4. Update `schema.ts` (Postgres fixes + new tables + tenant_id columns)
5. `npm run db:generate` → review generated SQL
6. `npm run db:migrate` → applies to Supabase
7. Run seed: `npm run db:seed` to insert `owner` tenant row + backfill

---

## 13. Env Vars

```bash
POSTGRES_URL=postgresql://...   # Supabase pooler URL (port 6543)
SESSION_SECRET=...              # existing
APP_PIN_HASH=...                # existing
DEALER_SESSION_SECRET=...       # new — generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 14. Success Criteria

- `npm run build` → 0 errors, 0 type errors
- Owner: `/unlock` → `/admin/dealers` → create dealer → credentials shown
- Dealer admin: `/dealer/login` → full sidebar → add activation → logout
- Dealer exec: `/dealer/login` → 3-tab nav → add activation → delete button absent
- Owner: `/admin/dealers/[id]` → sees dealer's activation in stats
- Chrome Android on deployed URL → install banner → installs standalone
- Set `expires_at` to yesterday → `/dealer/expired` lock screen

---

## 15. Constraints

- No existing table or column dropped or renamed
- `/unlock` owner flow untouched
- No SMTP — `mailto:` links only
- No `@supabase/supabase-js`
- Silent `catch` forbidden — every catch logs to `audit_log` or rethrows with context

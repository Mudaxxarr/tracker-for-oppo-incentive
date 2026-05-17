# OPPO SaaS — Phase 1: Postgres Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace better-sqlite3 with pg + Drizzle node-postgres against Supabase, add tenant_id to all scoped tables, keep the existing owner flow working unchanged.

**Architecture:** Fresh Postgres schema generated via drizzle-kit, applied to Supabase. Seed inserts `dealer_tenants(id='owner')` and backfills all existing rows. All query functions gain an explicit `tenantId` param. Owner actions hard-code `tenantId = 'owner'`.

**Tech Stack:** pg, drizzle-orm/node-postgres, drizzle-kit postgresql dialect, Supabase Postgres (pooler URL port 6543).

---

### Task 1: Install pg, remove SQLite types, add dotenv

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new deps and remove SQLite type dep**

```powershell
cd "C:\Users\Admin\Downloads\Claude\Oppo Ecosystem\oppo-tracker"
npm install pg dotenv
npm install --save-dev @types/pg
npm uninstall @types/better-sqlite3
```

Expected: no errors. `node_modules/pg` present. `@types/better-sqlite3` gone from package.json.

- [ ] **Step 2: Verify package.json**

`package.json` dependencies should now contain `"pg"` and `"dotenv"`. devDependencies should contain `"@types/pg"`. `"@types/better-sqlite3"` should be absent.

- [ ] **Step 3: Commit**

```powershell
git add package.json package-lock.json
git commit -m "deps: replace better-sqlite3 types with pg + @types/pg, add dotenv"
```

---

### Task 2: Add env vars + archive SQLite migrations + update drizzle config

**Files:**
- Modify: `.env.local`
- Modify: `drizzle.config.ts`
- Create dir: `lib/db/migrations-sqlite-archive/` (move existing migrations there)

- [ ] **Step 1: Add env vars to .env.local**

Open `.env.local` and append (do NOT overwrite existing vars):

```bash
POSTGRES_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
DEALER_SESSION_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

Replace placeholders with actual Supabase pooler URL and a generated secret.

- [ ] **Step 2: Archive SQLite migrations**

```powershell
mkdir "lib\db\migrations-sqlite-archive"
Move-Item "lib\db\migrations\*" "lib\db\migrations-sqlite-archive\"
```

- [ ] **Step 3: Update drizzle.config.ts**

Full file content:

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

- [ ] **Step 4: Commit**

```powershell
git add drizzle.config.ts lib/db/migrations-sqlite-archive/ .env.local
git commit -m "config: switch drizzle to postgresql dialect, archive sqlite migrations"
```

---

### Task 3: Rewrite schema.ts for Postgres

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Replace entire schema.ts**

```typescript
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const isoDate = (name: string) => text(name);
const isoDateTime = (name: string) =>
  text(name).default(sql`(now()::text)`);

// ---------- Dealer Tenants (multi-tenant) ----------
export const dealerTenants = pgTable("dealer_tenants", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  ownerEmail: text("owner_email").notNull().unique(),
  planMonths: integer("plan_months").notNull(),
  startedAt: isoDate("started_at").notNull(),
  expiresAt: isoDate("expires_at").notNull(),
  status: text("status").notNull().default("active"), // 'active'|'grace'|'expired'|'suspended'
  createdAt: isoDateTime("created_at").notNull(),
});

// ---------- Dealer Users ----------
export const dealerUsers = pgTable("dealer_users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => dealerTenants.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"), // 'admin'|'exec'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: isoDateTime("created_at").notNull(),
});

// ---------- Dealer IDs ----------
export const dealerIds = pgTable("dealer_ids", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => dealerTenants.id),
  name: text("name").notNull(),
  note: text("note"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: isoDateTime("created_at").notNull(),
});

// ---------- Models (global — shared across tenants) ----------
export const models = pgTable(
  "models",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sku: text("sku"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    uniqueName: uniqueIndex("models_name_unique").on(t.name),
  })
);

// ---------- Model price history (tenant-scoped: each tenant owns their prices) ----------
export const modelPriceHistory = pgTable(
  "model_price_history",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "cascade" }),
    dealerPrice: real("dealer_price").notNull(),
    invoicePrice: real("invoice_price").notNull(),
    effectiveFrom: isoDate("effective_from").notNull(),
    effectiveTo: isoDate("effective_to"),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byModel: index("mph_by_model").on(t.tenantId, t.modelId, t.effectiveFrom),
  })
);

// ---------- Purchases ----------
export const purchases = pgTable(
  "purchases",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealerIds.id, { onDelete: "cascade" }),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitDealerPrice: real("unit_dealer_price").notNull(),
    unitInvoicePrice: real("unit_invoice_price").notNull(),
    purchaseDate: isoDate("purchase_date").notNull(),
    source: text("source").notNull(),
    referenceNote: text("reference_note"),
    crossRegionTransferId: text("cross_region_transfer_id"),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("purchases_by_dealer").on(t.tenantId, t.dealerId, t.purchaseDate),
    byModel: index("purchases_by_model").on(t.tenantId, t.modelId, t.purchaseDate),
  })
);

// ---------- Activations ----------
export const activations = pgTable(
  "activations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealerIds.id, { onDelete: "cascade" }),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "restrict" }),
    purchaseId: text("purchase_id").references(() => purchases.id, {
      onDelete: "set null",
    }),
    imei: text("imei"),
    activationDate: isoDate("activation_date").notNull(),
    dealerPriceSnapshot: real("dealer_price_snapshot").notNull(),
    isCrossRegion: boolean("is_cross_region").notNull().default(false),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("activations_by_dealer").on(t.tenantId, t.dealerId, t.activationDate),
    byModel: index("activations_by_model").on(t.tenantId, t.modelId, t.activationDate),
    byImei: uniqueIndex("activations_imei_unique").on(t.imei),
  })
);

// ---------- Target Bonus Policies ----------
export const targetBonusPolicies = pgTable(
  "target_bonus_policies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealerIds.id, { onDelete: "cascade" }),
    periodStart: isoDate("period_start").notNull(),
    periodEnd: isoDate("period_end").notNull(),
    targetActivationsQty: integer("target_activations_qty").notNull(),
    bonusPercent: real("bonus_percent").notNull().default(1),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("tbp_by_dealer").on(t.tenantId, t.dealerId, t.periodStart),
  })
);

// ---------- Stock-In Policies ----------
export const stockInPolicies = pgTable(
  "stock_in_policies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealerIds.id, { onDelete: "cascade" }),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "restrict" }),
    periodStart: isoDate("period_start").notNull(),
    periodEnd: isoDate("period_end").notNull(),
    perUnitAmount: real("per_unit_amount").notNull(),
    minQty: integer("min_qty"),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("sip_by_dealer").on(t.tenantId, t.dealerId, t.periodStart),
    byModel: index("sip_by_model").on(t.tenantId, t.modelId, t.periodStart),
  })
);

// ---------- Activation Incentive Policies ----------
export const activationIncentivePolicies = pgTable(
  "activation_incentive_policies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealerIds.id, { onDelete: "cascade" }),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "restrict" }),
    periodStart: isoDate("period_start").notNull(),
    periodEnd: isoDate("period_end").notNull(),
    perUnitAmount: real("per_unit_amount").notNull(),
    targetQty: integer("target_qty"),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("aip_by_dealer").on(t.tenantId, t.dealerId, t.periodStart),
    byModel: index("aip_by_model").on(t.tenantId, t.modelId, t.periodStart),
  })
);

// ---------- Dealer Incentive Policies ----------
export const dealerIncentivePolicies = pgTable(
  "dealer_incentive_policies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealerIds.id, { onDelete: "cascade" }),
    modelId: text("model_id").references(() => models.id, {
      onDelete: "restrict",
    }),
    periodStart: isoDate("period_start").notNull(),
    periodEnd: isoDate("period_end").notNull(),
    targetTotalActivations: integer("target_total_activations").notNull(),
    perUnitAmount: real("per_unit_amount").notNull(),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("dip_by_dealer").on(t.tenantId, t.dealerId, t.periodStart),
  })
);

// ---------- Cross-Region Transfers ----------
export const crossRegionTransfers = pgTable(
  "cross_region_transfers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealerIds.id, { onDelete: "cascade" }),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    reportedDate: isoDate("reported_date").notNull(),
    shiftedToIdDate: isoDate("shifted_to_id_date"),
    sourceRegionNote: text("source_region_note"),
    status: text("status").notNull(),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("crt_by_dealer").on(t.tenantId, t.dealerId, t.reportedDate),
  })
);

// ---------- Inter-ID Transfers ----------
export const interIdTransfers = pgTable(
  "inter_id_transfers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id),
    fromDealerId: text("from_dealer_id")
      .notNull()
      .references(() => dealerIds.id, { onDelete: "cascade" }),
    toDealerId: text("to_dealer_id")
      .notNull()
      .references(() => dealerIds.id, { onDelete: "cascade" }),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    transferDate: isoDate("transfer_date").notNull(),
    note: text("note"),
    status: text("status").notNull().default("ACCEPTED"),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byFrom: index("iit_by_from").on(t.tenantId, t.fromDealerId, t.transferDate),
    byTo: index("iit_by_to").on(t.tenantId, t.toDealerId, t.transferDate),
  })
);

// ---------- CR Caught ----------
export const crCaught = pgTable(
  "cr_caught",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealerIds.id, { onDelete: "cascade" }),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    caughtDate: isoDate("caught_date").notNull(),
    dealerPriceSnapshot: real("dealer_price_snapshot").notNull(),
    note: text("note"),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("crc_by_dealer").on(t.tenantId, t.dealerId, t.caughtDate),
  })
);

// ---------- App settings (global — owner only) ----------
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: isoDateTime("updated_at").notNull(),
});

// ---------- Audit log (global) ----------
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    action: text("action").notNull(),
    dealerId: text("dealer_id"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    status: text("status").notNull().default("ok"),
    payload: text("payload"),
    summary: text("summary").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("audit_by_dealer").on(t.dealerId, t.createdAt),
    byAction: index("audit_by_action").on(t.action, t.createdAt),
    byCreated: index("audit_by_created").on(t.createdAt),
  })
);

// ----- Type exports -----
export type DealerTenant = typeof dealerTenants.$inferSelect;
export type NewDealerTenant = typeof dealerTenants.$inferInsert;
export type DealerUser = typeof dealerUsers.$inferSelect;
export type NewDealerUser = typeof dealerUsers.$inferInsert;
export type DealerId = typeof dealerIds.$inferSelect;
export type NewDealerId = typeof dealerIds.$inferInsert;
export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
export type ModelPriceHistory = typeof modelPriceHistory.$inferSelect;
export type NewModelPriceHistory = typeof modelPriceHistory.$inferInsert;
export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;
export type Activation = typeof activations.$inferSelect;
export type NewActivation = typeof activations.$inferInsert;
export type TargetBonusPolicy = typeof targetBonusPolicies.$inferSelect;
export type NewTargetBonusPolicy = typeof targetBonusPolicies.$inferInsert;
export type StockInPolicy = typeof stockInPolicies.$inferSelect;
export type NewStockInPolicy = typeof stockInPolicies.$inferInsert;
export type ActivationIncentivePolicy = typeof activationIncentivePolicies.$inferSelect;
export type NewActivationIncentivePolicy = typeof activationIncentivePolicies.$inferInsert;
export type DealerIncentivePolicy = typeof dealerIncentivePolicies.$inferSelect & {
  modelId?: string | null;
};
export type NewDealerIncentivePolicy = typeof dealerIncentivePolicies.$inferInsert;
export type CrossRegionTransfer = typeof crossRegionTransfers.$inferSelect;
export type NewCrossRegionTransfer = typeof crossRegionTransfers.$inferInsert;
export type InterIdTransfer = typeof interIdTransfers.$inferSelect;
export type NewInterIdTransfer = typeof interIdTransfers.$inferInsert;
export type CrCaught = typeof crCaught.$inferSelect;
export type NewCrCaught = typeof crCaught.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
```

- [ ] **Step 2: Commit**

```powershell
git add lib/db/schema.ts
git commit -m "schema: migrate to pg-core, add tenant_id to scoped tables, add dealer_tenants + dealer_users"
```

---

### Task 4: Rewrite lib/db/client.ts and lib/db/migrate.ts

**Files:**
- Modify: `lib/db/client.ts`
- Modify: `lib/db/migrate.ts`

- [ ] **Step 1: Rewrite lib/db/client.ts**

```typescript
import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type AppDb = NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __oppoDb: AppDb | undefined;
  // eslint-disable-next-line no-var
  var __oppoPool: Pool | undefined;
}

function createPool(): Pool {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL environment variable is required");
  return new Pool({ connectionString: url, max: 10 });
}

const pool: Pool = globalThis.__oppoPool ?? createPool();
globalThis.__oppoPool = pool;

export const db: AppDb = globalThis.__oppoDb ?? drizzle(pool, { schema });
globalThis.__oppoDb = db;

export { schema };
```

- [ ] **Step 2: Rewrite lib/db/migrate.ts**

```typescript
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL environment variable is required");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  const migrationsFolder = path.resolve(process.cwd(), "lib/db/migrations");

  console.log("Running migrations →", migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("✅ Migrations applied");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Commit**

```powershell
git add lib/db/client.ts lib/db/migrate.ts
git commit -m "db: replace better-sqlite3 with pg Pool + drizzle node-postgres"
```

---

### Task 5: Generate and apply Postgres migrations + rewrite seed.ts

**Files:**
- Create: `lib/db/migrations/` (auto-generated by drizzle-kit)
- Modify: `lib/db/seed.ts`

- [ ] **Step 1: Load env and generate migration**

```powershell
$env:POSTGRES_URL = (Get-Content .env.local | Select-String "POSTGRES_URL").ToString().Split("=",2)[1]
npx drizzle-kit generate
```

Expected: `lib/db/migrations/0000_*.sql` created. Review the SQL — it should CREATE TABLE for all tables including `dealer_tenants`, `dealer_users`, and the `tenant_id` columns.

- [ ] **Step 2: Apply migration to Supabase**

```powershell
npm run db:migrate
```

Expected output:
```
Running migrations → .../lib/db/migrations
✅ Migrations applied
```

If it fails with a connection error, verify `POSTGRES_URL` is the pooler URL (port 6543, not 5432).

- [ ] **Step 3: Rewrite lib/db/seed.ts**

```typescript
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL environment variable is required");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  // Upsert owner tenant
  const existing = await db
    .select()
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, "owner"))
    .limit(1);

  if (existing.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const far = "2099-12-31";
    await db.insert(schema.dealerTenants).values({
      id: "owner",
      businessName: "Alhamd Telecom (Owner)",
      ownerEmail: "owner@alhamd.internal",
      planMonths: 999,
      startedAt: today,
      expiresAt: far,
      status: "active",
    });
    console.log("✅ Inserted owner tenant");
  } else {
    console.log("Owner tenant already exists — skipping insert");
  }

  // Backfill tenant_id = 'owner' on all scoped tables where tenant_id is null
  const tables = [
    "dealer_ids",
    "model_price_history",
    "purchases",
    "activations",
    "cross_region_transfers",
    "inter_id_transfers",
    "cr_caught",
    "target_bonus_policies",
    "stock_in_policies",
    "activation_incentive_policies",
    "dealer_incentive_policies",
  ];

  for (const table of tables) {
    const result = await pool.query(
      `UPDATE ${table} SET tenant_id = 'owner' WHERE tenant_id IS NULL`
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`✅ Backfilled ${result.rowCount} rows in ${table}`);
    }
  }

  // Seed sample data only if dealer_ids is empty
  const dealerCount = await db.select().from(schema.dealerIds).limit(1);
  if (dealerCount.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const dealerId = randomUUID();
    await db.insert(schema.dealerIds).values({
      id: dealerId,
      tenantId: "owner",
      name: "Khanewal Main",
      note: "Primary dealer ID",
      isActive: true,
    });

    const sampleModels = [
      { name: "OPPO Reno 12 Pro 12+512", sku: "RENO12PRO-12-512", dealer: 145000, invoice: 158000 },
      { name: "OPPO Reno 12 8+256", sku: "RENO12-8-256", dealer: 95000, invoice: 104000 },
      { name: "OPPO A78 8+256", sku: "A78-8-256", dealer: 52000, invoice: 56500 },
      { name: "OPPO A60 8+128", sku: "A60-8-128", dealer: 38000, invoice: 41500 },
      { name: "OPPO Find X8 16+512", sku: "FINDX8-16-512", dealer: 295000, invoice: 320000 },
    ];

    for (const m of sampleModels) {
      const modelId = randomUUID();
      await db.insert(schema.models).values({ id: modelId, name: m.name, sku: m.sku, isActive: true });
      await db.insert(schema.modelPriceHistory).values({
        id: randomUUID(),
        tenantId: "owner",
        modelId,
        dealerPrice: m.dealer,
        invoicePrice: m.invoice,
        effectiveFrom: today,
        effectiveTo: null,
      });
    }
    console.log("✅ Seeded sample dealer + models");
  }

  await pool.end();
  console.log("✅ Seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Run seed**

```powershell
npm run db:seed
```

Expected: `✅ Inserted owner tenant`, `✅ Seed complete`.

- [ ] **Step 5: Commit**

```powershell
git add lib/db/migrations/ lib/db/seed.ts
git commit -m "db: generate postgres migrations, rewrite seed for multi-tenant"
```

---

### Task 6: Update all query files — add tenantId param

**Files:**
- Modify: `lib/db/queries/activations.ts`
- Modify: `lib/db/queries/purchases.ts`
- Modify: `lib/db/queries/inventory.ts`
- Modify: `lib/db/queries/cr-caught.ts`
- Modify: `lib/db/queries/models.ts`
- Modify: `lib/db/queries/policies.ts`
- Modify: `lib/db/queries/transfers.ts`

- [ ] **Step 1: Rewrite lib/db/queries/activations.ts**

```typescript
import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getPriceOnDate } from "./models";

export interface ActivationRow {
  id: string;
  modelId: string;
  modelName: string;
  imei: string | null;
  activationDate: string;
  dealerPriceSnapshot: number;
  isCrossRegion: boolean;
  purchaseId: string | null;
}

export async function listActivations(filters: {
  tenantId: string;
  dealerId: string;
  modelId?: string;
  from?: string;
  to?: string;
}): Promise<ActivationRow[]> {
  const where = [
    eq(schema.activations.tenantId, filters.tenantId),
    eq(schema.activations.dealerId, filters.dealerId),
  ];
  if (filters.modelId) where.push(eq(schema.activations.modelId, filters.modelId));
  if (filters.from) where.push(gte(schema.activations.activationDate, filters.from));
  if (filters.to) where.push(lte(schema.activations.activationDate, filters.to));

  const rows = await db
    .select({
      id: schema.activations.id,
      modelId: schema.activations.modelId,
      modelName: schema.models.name,
      imei: schema.activations.imei,
      activationDate: schema.activations.activationDate,
      dealerPriceSnapshot: schema.activations.dealerPriceSnapshot,
      isCrossRegion: schema.activations.isCrossRegion,
      purchaseId: schema.activations.purchaseId,
    })
    .from(schema.activations)
    .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
    .where(and(...where))
    .orderBy(desc(schema.activations.activationDate), asc(schema.models.name));
  return rows;
}

export async function createActivation(input: {
  tenantId: string;
  dealerId: string;
  modelId: string;
  activationDate: string;
  imei: string | null;
  purchaseId: string | null;
  isCrossRegion: boolean;
  dealerPriceOverride?: number;
}): Promise<{ id: string; pricedAt: number; isCrossRegion: boolean }> {
  const id = randomUUID();
  let snapshot = input.dealerPriceOverride;
  if (snapshot == null) {
    const price = await getPriceOnDate(input.tenantId, input.modelId, input.activationDate);
    if (!price) throw new Error("No dealer price defined for this model on or before the activation date");
    snapshot = price.dealerPrice;
  }
  let isCrossRegion = input.isCrossRegion;
  if (input.purchaseId) {
    const linked = await db
      .select()
      .from(schema.purchases)
      .where(and(eq(schema.purchases.id, input.purchaseId), eq(schema.purchases.tenantId, input.tenantId)))
      .limit(1);
    if (linked.length > 0 && linked[0].source === "CROSS_REGION_TRANSFER_IN") isCrossRegion = true;
  }
  await db.insert(schema.activations).values({
    id,
    tenantId: input.tenantId,
    dealerId: input.dealerId,
    modelId: input.modelId,
    activationDate: input.activationDate,
    imei: input.imei,
    purchaseId: input.purchaseId,
    isCrossRegion,
    dealerPriceSnapshot: snapshot,
  });
  return { id, pricedAt: snapshot, isCrossRegion };
}

export async function deleteActivation(id: string, dealerId: string, tenantId: string): Promise<void> {
  await db
    .delete(schema.activations)
    .where(
      and(
        eq(schema.activations.id, id),
        eq(schema.activations.dealerId, dealerId),
        eq(schema.activations.tenantId, tenantId)
      )
    );
}
```

- [ ] **Step 2: Rewrite lib/db/queries/cr-caught.ts**

```typescript
import "server-only";
import { db, schema } from "../client";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export interface CrCaughtRow {
  id: string;
  modelId: string;
  modelName: string;
  quantity: number;
  caughtDate: string;
  dealerPriceSnapshot: number;
  note: string | null;
}

export async function listCrCaught(tenantId: string, dealerId: string): Promise<CrCaughtRow[]> {
  return db
    .select({
      id: schema.crCaught.id,
      modelId: schema.crCaught.modelId,
      modelName: schema.models.name,
      quantity: schema.crCaught.quantity,
      caughtDate: schema.crCaught.caughtDate,
      dealerPriceSnapshot: schema.crCaught.dealerPriceSnapshot,
      note: schema.crCaught.note,
    })
    .from(schema.crCaught)
    .innerJoin(schema.models, eq(schema.models.id, schema.crCaught.modelId))
    .where(and(eq(schema.crCaught.tenantId, tenantId), eq(schema.crCaught.dealerId, dealerId)))
    .orderBy(desc(schema.crCaught.caughtDate));
}

export async function createCrCaught(input: {
  tenantId: string;
  dealerId: string;
  modelId: string;
  quantity: number;
  caughtDate: string;
  dealerPriceSnapshot: number;
  note: string | null;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.crCaught).values({ id, ...input });
  return id;
}

export async function getCrCaughtLoss(
  tenantId: string,
  dealerId: string,
  from: string,
  to: string,
  basePct: number
): Promise<{ totalUnits: number; lostIncentive: number }> {
  const rows = await db
    .select({ qty: schema.crCaught.quantity, price: schema.crCaught.dealerPriceSnapshot })
    .from(schema.crCaught)
    .where(
      and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        gte(schema.crCaught.caughtDate, from),
        lte(schema.crCaught.caughtDate, to)
      )
    );
  let totalUnits = 0;
  let lostIncentive = 0;
  for (const r of rows) {
    totalUnits += r.qty;
    lostIncentive += r.qty * r.price * (basePct / 100) * 1.25;
  }
  return { totalUnits, lostIncentive: Math.round(lostIncentive) };
}

export async function getCrCaughtForStockCalc(tenantId: string, dealerId: string, modelId: string): Promise<number> {
  const [{ qty }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)` })
    .from(schema.crCaught)
    .where(
      and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        eq(schema.crCaught.modelId, modelId)
      )
    );
  return Number(qty);
}

export async function getCrCaughtAsOf(tenantId: string, dealerId: string, modelId: string, asOf: string): Promise<number> {
  const [{ qty }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)` })
    .from(schema.crCaught)
    .where(
      and(
        eq(schema.crCaught.tenantId, tenantId),
        eq(schema.crCaught.dealerId, dealerId),
        eq(schema.crCaught.modelId, modelId),
        lte(schema.crCaught.caughtDate, asOf)
      )
    );
  return Number(qty);
}
```

- [ ] **Step 3: Rewrite lib/db/queries/models.ts**

Key change: `getPriceOnDate`, `listPriceHistory`, `createModel`, `updateModelPrice`, `addPriceEntry`, `updatePriceEntry`, `deletePriceEntry` all receive `tenantId` and filter `model_price_history` by it. `listModelsWithCurrentPrice` also takes `tenantId`.

```typescript
import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export interface ModelWithCurrentPrice {
  id: string;
  name: string;
  sku: string | null;
  isActive: boolean;
  dealerPrice: number | null;
  invoicePrice: number | null;
}

export async function listModelsWithCurrentPrice(tenantId: string): Promise<ModelWithCurrentPrice[]> {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({
      id: schema.models.id,
      name: schema.models.name,
      sku: schema.models.sku,
      isActive: schema.models.isActive,
      dealerPrice: schema.modelPriceHistory.dealerPrice,
      invoicePrice: schema.modelPriceHistory.invoicePrice,
    })
    .from(schema.models)
    .leftJoin(
      schema.modelPriceHistory,
      and(
        eq(schema.modelPriceHistory.tenantId, tenantId),
        eq(schema.modelPriceHistory.modelId, schema.models.id),
        lte(schema.modelPriceHistory.effectiveFrom, today),
        or(isNull(schema.modelPriceHistory.effectiveTo), gt(schema.modelPriceHistory.effectiveTo, today))
      )
    )
    .orderBy(asc(schema.models.name));
}

export async function getModelById(id: string) {
  const rows = await db.select().from(schema.models).where(eq(schema.models.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getPriceOnDate(
  tenantId: string,
  modelId: string,
  date: string
): Promise<{ dealerPrice: number; invoicePrice: number } | null> {
  const rows = await db
    .select()
    .from(schema.modelPriceHistory)
    .where(
      and(
        eq(schema.modelPriceHistory.tenantId, tenantId),
        eq(schema.modelPriceHistory.modelId, modelId),
        lte(schema.modelPriceHistory.effectiveFrom, date),
        or(isNull(schema.modelPriceHistory.effectiveTo), gt(schema.modelPriceHistory.effectiveTo, date))
      )
    )
    .orderBy(desc(schema.modelPriceHistory.effectiveFrom))
    .limit(1);
  if (rows.length === 0) return null;
  return { dealerPrice: rows[0].dealerPrice, invoicePrice: rows[0].invoicePrice };
}

export async function listPriceHistory(tenantId: string, modelId: string) {
  return db
    .select()
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.tenantId, tenantId), eq(schema.modelPriceHistory.modelId, modelId)))
    .orderBy(desc(schema.modelPriceHistory.effectiveFrom));
}

export async function createModel(
  tenantId: string,
  input: { name: string; sku: string | null; dealerPrice: number; invoicePrice: number; effectiveFrom?: string }
): Promise<string> {
  const modelId = randomUUID();
  const today = input.effectiveFrom ?? new Date().toISOString().slice(0, 10);
  await db.insert(schema.models).values({ id: modelId, name: input.name, sku: input.sku, isActive: true });
  await db.insert(schema.modelPriceHistory).values({
    id: randomUUID(),
    tenantId,
    modelId,
    dealerPrice: input.dealerPrice,
    invoicePrice: input.invoicePrice,
    effectiveFrom: today,
    effectiveTo: null,
  });
  return modelId;
}

export async function updateModelPrice(
  tenantId: string,
  input: { modelId: string; dealerPrice: number; invoicePrice: number; effectiveFrom: string }
): Promise<void> {
  await db
    .update(schema.modelPriceHistory)
    .set({ effectiveTo: input.effectiveFrom })
    .where(
      and(
        eq(schema.modelPriceHistory.tenantId, tenantId),
        eq(schema.modelPriceHistory.modelId, input.modelId),
        isNull(schema.modelPriceHistory.effectiveTo)
      )
    );
  await db.insert(schema.modelPriceHistory).values({
    id: randomUUID(),
    tenantId,
    modelId: input.modelId,
    dealerPrice: input.dealerPrice,
    invoicePrice: input.invoicePrice,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
  });
}

async function restitchPriceHistory(tenantId: string, modelId: string): Promise<void> {
  const rows = await db
    .select()
    .from(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.tenantId, tenantId), eq(schema.modelPriceHistory.modelId, modelId)))
    .orderBy(asc(schema.modelPriceHistory.effectiveFrom));
  for (let i = 0; i < rows.length; i++) {
    const next = rows[i + 1];
    const targetEffectiveTo = next ? next.effectiveFrom : null;
    if (rows[i].effectiveTo !== targetEffectiveTo) {
      await db
        .update(schema.modelPriceHistory)
        .set({ effectiveTo: targetEffectiveTo })
        .where(eq(schema.modelPriceHistory.id, rows[i].id));
    }
  }
}

export async function addPriceEntry(
  tenantId: string,
  input: { modelId: string; dealerPrice: number; invoicePrice: number; effectiveFrom: string }
): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.modelPriceHistory).values({ id, tenantId, ...input, effectiveTo: null });
  await restitchPriceHistory(tenantId, input.modelId);
  return id;
}

export async function updatePriceEntry(
  tenantId: string,
  input: { modelId: string; priceId: string; dealerPrice: number; invoicePrice: number; effectiveFrom: string }
): Promise<void> {
  await db
    .update(schema.modelPriceHistory)
    .set({ dealerPrice: input.dealerPrice, invoicePrice: input.invoicePrice, effectiveFrom: input.effectiveFrom })
    .where(and(eq(schema.modelPriceHistory.id, input.priceId), eq(schema.modelPriceHistory.tenantId, tenantId)));
  await restitchPriceHistory(tenantId, input.modelId);
}

export async function deletePriceEntry(
  tenantId: string,
  input: { modelId: string; priceId: string }
): Promise<void> {
  await db
    .delete(schema.modelPriceHistory)
    .where(and(eq(schema.modelPriceHistory.id, input.priceId), eq(schema.modelPriceHistory.tenantId, tenantId)));
  await restitchPriceHistory(tenantId, input.modelId);
}

export async function updateModel(input: {
  id: string; name: string; sku: string | null; isActive: boolean;
}): Promise<void> {
  await db.update(schema.models).set({ name: input.name, sku: input.sku, isActive: input.isActive }).where(eq(schema.models.id, input.id));
}

export async function deleteModel(modelId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [{ purchaseCount }] = await db
    .select({ purchaseCount: sql<number>`COUNT(*)` })
    .from(schema.purchases)
    .where(eq(schema.purchases.modelId, modelId));
  if (Number(purchaseCount) > 0) return { ok: false, reason: `${Number(purchaseCount)} purchase(s) still reference this model` };
  const [{ activationCount }] = await db
    .select({ activationCount: sql<number>`COUNT(*)` })
    .from(schema.activations)
    .where(eq(schema.activations.modelId, modelId));
  if (Number(activationCount) > 0) return { ok: false, reason: `${Number(activationCount)} activation(s) still reference this model` };
  await db.delete(schema.models).where(eq(schema.models.id, modelId));
  return { ok: true };
}
```

- [ ] **Step 4: Rewrite lib/db/queries/purchases.ts**

```typescript
import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { INTER_ID_STATUS } from "@/lib/constants";
import { randomUUID } from "node:crypto";
import type { PurchaseSource } from "@/lib/constants";
import { getCrCaughtForStockCalc, getCrCaughtAsOf } from "./cr-caught";

export interface StockRow {
  modelId: string;
  modelName: string;
  dealerPrice: number | null;
  invoicePrice: number | null;
  quantity: number;
}

export async function listStockForDealer(tenantId: string, dealerId: string): Promise<StockRow[]> {
  const today = new Date().toISOString().slice(0, 10);

  const purchaseQty = await db
    .select({ modelId: schema.purchases.modelId, qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId)))
    .groupBy(schema.purchases.modelId);

  const activatedQty = await db
    .select({ modelId: schema.activations.modelId, qty: sql<number>`COUNT(*)` })
    .from(schema.activations)
    .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId)))
    .groupBy(schema.activations.modelId);

  const transferredOutQty = await db
    .select({ modelId: schema.interIdTransfers.modelId, qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.tenantId, tenantId),
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      )
    )
    .groupBy(schema.interIdTransfers.modelId);

  const crCaughtQty = await db
    .select({ modelId: schema.crCaught.modelId, qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)` })
    .from(schema.crCaught)
    .where(and(eq(schema.crCaught.tenantId, tenantId), eq(schema.crCaught.dealerId, dealerId)))
    .groupBy(schema.crCaught.modelId);

  const byModel = new Map<string, number>();
  for (const r of purchaseQty) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) + Number(r.qty));
  for (const r of activatedQty) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) - Number(r.qty));
  for (const r of transferredOutQty) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) - Number(r.qty));
  for (const r of crCaughtQty) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) - Number(r.qty));

  const ids = [...byModel.entries()].filter(([, q]) => q > 0).map(([id]) => id);
  if (ids.length === 0) return [];

  const meta = await db
    .select({
      id: schema.models.id,
      name: schema.models.name,
      dealerPrice: schema.modelPriceHistory.dealerPrice,
      invoicePrice: schema.modelPriceHistory.invoicePrice,
    })
    .from(schema.models)
    .leftJoin(
      schema.modelPriceHistory,
      and(
        eq(schema.modelPriceHistory.tenantId, tenantId),
        eq(schema.modelPriceHistory.modelId, schema.models.id),
        lte(schema.modelPriceHistory.effectiveFrom, today),
        sql`(${schema.modelPriceHistory.effectiveTo} IS NULL OR ${schema.modelPriceHistory.effectiveTo} > ${today})`
      )
    )
    .where(sql`${schema.models.id} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);

  return meta
    .map((m) => ({ modelId: m.id, modelName: m.name, dealerPrice: m.dealerPrice, invoicePrice: m.invoicePrice, quantity: byModel.get(m.id) ?? 0 }))
    .filter((r) => r.quantity > 0)
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

export async function getStockForModel(tenantId: string, dealerId: string, modelId: string): Promise<number> {
  const [{ qty: pq }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.modelId, modelId)));
  const [{ qty: aq }] = await db
    .select({ qty: sql<number>`COUNT(*)` })
    .from(schema.activations)
    .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.modelId, modelId)));
  const [{ qty: tq }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.tenantId, tenantId),
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        eq(schema.interIdTransfers.modelId, modelId),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      )
    );
  const crcQty = await getCrCaughtForStockCalc(tenantId, dealerId, modelId);
  return Number(pq) - Number(aq) - Number(tq) - crcQty;
}

export async function getStockForModelAsOf(tenantId: string, dealerId: string, modelId: string, asOf: string): Promise<number> {
  const [{ qty: pq }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.modelId, modelId), lte(schema.purchases.purchaseDate, asOf)));
  const [{ qty: aq }] = await db
    .select({ qty: sql<number>`COUNT(*)` })
    .from(schema.activations)
    .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId), eq(schema.activations.modelId, modelId), lte(schema.activations.activationDate, asOf)));
  const [{ qty: tq }] = await db
    .select({ qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
    .from(schema.interIdTransfers)
    .where(
      and(
        eq(schema.interIdTransfers.tenantId, tenantId),
        eq(schema.interIdTransfers.fromDealerId, dealerId),
        eq(schema.interIdTransfers.modelId, modelId),
        lte(schema.interIdTransfers.transferDate, asOf),
        ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)
      )
    );
  const crcQty = await getCrCaughtAsOf(tenantId, dealerId, modelId, asOf);
  return Number(pq) - Number(aq) - Number(tq) - crcQty;
}

export interface PurchaseRow {
  id: string; modelId: string; modelName: string; quantity: number;
  unitDealerPrice: number; unitInvoicePrice: number; purchaseDate: string;
  source: string; referenceNote: string | null; crossRegionTransferId: string | null;
}

export async function listPurchases(filters: {
  tenantId: string; dealerId: string; modelId?: string; source?: PurchaseSource; from?: string; to?: string;
}): Promise<PurchaseRow[]> {
  const where = [eq(schema.purchases.tenantId, filters.tenantId), eq(schema.purchases.dealerId, filters.dealerId)];
  if (filters.modelId) where.push(eq(schema.purchases.modelId, filters.modelId));
  if (filters.source) where.push(eq(schema.purchases.source, filters.source));
  if (filters.from) where.push(gte(schema.purchases.purchaseDate, filters.from));
  if (filters.to) where.push(lte(schema.purchases.purchaseDate, filters.to));

  return db
    .select({
      id: schema.purchases.id, modelId: schema.purchases.modelId, modelName: schema.models.name,
      quantity: schema.purchases.quantity, unitDealerPrice: schema.purchases.unitDealerPrice,
      unitInvoicePrice: schema.purchases.unitInvoicePrice, purchaseDate: schema.purchases.purchaseDate,
      source: schema.purchases.source, referenceNote: schema.purchases.referenceNote,
      crossRegionTransferId: schema.purchases.crossRegionTransferId,
    })
    .from(schema.purchases)
    .innerJoin(schema.models, eq(schema.models.id, schema.purchases.modelId))
    .where(and(...where))
    .orderBy(desc(schema.purchases.purchaseDate), asc(schema.models.name));
}

export async function createPurchase(input: {
  tenantId: string; dealerId: string; modelId: string; quantity: number;
  unitDealerPrice: number; unitInvoicePrice: number; purchaseDate: string;
  source: PurchaseSource; referenceNote: string | null; crossRegionTransferId?: string | null;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.purchases).values({ id, ...input, crossRegionTransferId: input.crossRegionTransferId ?? null });
  return id;
}

export async function deletePurchase(id: string, dealerId: string, tenantId: string): Promise<void> {
  await db.delete(schema.purchases).where(and(eq(schema.purchases.id, id), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.tenantId, tenantId)));
}
```

- [ ] **Step 5: Rewrite lib/db/queries/inventory.ts**

```typescript
import "server-only";
import { db, schema } from "../client";
import { and, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";
import { INTER_ID_STATUS } from "@/lib/constants";

export interface InventoryModelRow {
  modelId: string; modelName: string; dealerPrice: number | null;
  invoicePrice: number | null; totalStock: number;
  regularQty: number; crossRegionQty: number; interIdInQty: number;
}

export async function listInventoryForDealer(tenantId: string, dealerId: string): Promise<InventoryModelRow[]> {
  const today = new Date().toISOString().slice(0, 10);

  const purchaseRows = await db
    .select({ modelId: schema.purchases.modelId, source: schema.purchases.source, qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
    .from(schema.purchases)
    .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId)))
    .groupBy(schema.purchases.modelId, schema.purchases.source);

  const activationRows = await db
    .select({ modelId: schema.activations.modelId, qty: sql<number>`COUNT(*)` })
    .from(schema.activations)
    .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId)))
    .groupBy(schema.activations.modelId);

  const transferOutRows = await db
    .select({ modelId: schema.interIdTransfers.modelId, qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
    .from(schema.interIdTransfers)
    .where(and(eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.fromDealerId, dealerId), ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED)))
    .groupBy(schema.interIdTransfers.modelId);

  const crCaughtRows = await db
    .select({ modelId: schema.crCaught.modelId, qty: sql<number>`COALESCE(SUM(${schema.crCaught.quantity}), 0)` })
    .from(schema.crCaught)
    .where(and(eq(schema.crCaught.tenantId, tenantId), eq(schema.crCaught.dealerId, dealerId)))
    .groupBy(schema.crCaught.modelId);

  const interIdInRows = await db
    .select({ modelId: schema.interIdTransfers.modelId, qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
    .from(schema.interIdTransfers)
    .where(and(eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.toDealerId, dealerId), eq(schema.interIdTransfers.status, INTER_ID_STATUS.ACCEPTED)))
    .groupBy(schema.interIdTransfers.modelId);

  const activatedMap = new Map<string, number>();
  for (const r of activationRows) activatedMap.set(r.modelId, Number(r.qty));
  const transferOutMap = new Map<string, number>();
  for (const r of transferOutRows) transferOutMap.set(r.modelId, Number(r.qty));
  const crCaughtMap = new Map<string, number>();
  for (const r of crCaughtRows) crCaughtMap.set(r.modelId, Number(r.qty));
  const regularMap = new Map<string, number>();
  const crossRegionMap = new Map<string, number>();
  const interIdMap = new Map<string, number>();
  const allModelIds = new Set<string>();

  for (const r of purchaseRows) {
    allModelIds.add(r.modelId);
    if (r.source === "CROSS_REGION_TRANSFER_IN") {
      crossRegionMap.set(r.modelId, (crossRegionMap.get(r.modelId) ?? 0) + Number(r.qty));
    } else {
      regularMap.set(r.modelId, (regularMap.get(r.modelId) ?? 0) + Number(r.qty));
    }
  }
  for (const r of interIdInRows) {
    allModelIds.add(r.modelId);
    interIdMap.set(r.modelId, Number(r.qty));
    regularMap.set(r.modelId, Math.max(0, (regularMap.get(r.modelId) ?? 0) - Number(r.qty)));
  }

  const netStock = new Map<string, number>();
  for (const modelId of allModelIds) {
    const total = (regularMap.get(modelId) ?? 0) + (crossRegionMap.get(modelId) ?? 0) + (interIdMap.get(modelId) ?? 0);
    const used = (activatedMap.get(modelId) ?? 0) + (transferOutMap.get(modelId) ?? 0) + (crCaughtMap.get(modelId) ?? 0);
    netStock.set(modelId, total - used);
  }

  const positiveIds = [...netStock.entries()].filter(([, q]) => q > 0).map(([id]) => id);
  if (positiveIds.length === 0) return [];

  const meta = await db
    .select({ id: schema.models.id, name: schema.models.name, dealerPrice: schema.modelPriceHistory.dealerPrice, invoicePrice: schema.modelPriceHistory.invoicePrice })
    .from(schema.models)
    .leftJoin(
      schema.modelPriceHistory,
      and(
        eq(schema.modelPriceHistory.tenantId, tenantId),
        eq(schema.modelPriceHistory.modelId, schema.models.id),
        lte(schema.modelPriceHistory.effectiveFrom, today),
        or(isNull(schema.modelPriceHistory.effectiveTo), gt(schema.modelPriceHistory.effectiveTo, today))
      )
    )
    .where(sql`${schema.models.id} IN (${sql.join(positiveIds.map((i) => sql`${i}`), sql`, `)})`);

  return meta
    .map((m): InventoryModelRow => ({
      modelId: m.id, modelName: m.name, dealerPrice: m.dealerPrice, invoicePrice: m.invoicePrice,
      totalStock: netStock.get(m.id) ?? 0,
      regularQty: regularMap.get(m.id) ?? 0,
      crossRegionQty: crossRegionMap.get(m.id) ?? 0,
      interIdInQty: interIdMap.get(m.id) ?? 0,
    }))
    .filter((r) => r.totalStock > 0)
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}
```

- [ ] **Step 6: Rewrite lib/db/queries/policies.ts**

Every function gains a `tenantId` first parameter and adds `eq(schema.<table>.tenantId, tenantId)` to WHERE clauses. Inserts include `tenantId`. Full file:

```typescript
import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

// ===== Target Bonus =====

export async function listTargetBonusPolicies(tenantId: string, dealerId: string) {
  return db.select().from(schema.targetBonusPolicies)
    .where(and(eq(schema.targetBonusPolicies.tenantId, tenantId), eq(schema.targetBonusPolicies.dealerId, dealerId)))
    .orderBy(desc(schema.targetBonusPolicies.periodStart));
}

export async function createTargetBonusPolicy(input: {
  tenantId: string; dealerId: string; periodStart: string; periodEnd: string;
  targetActivationsQty: number; bonusPercent: number;
}) {
  const id = randomUUID();
  await db.insert(schema.targetBonusPolicies).values({ id, ...input });
  return id;
}

export async function updateTargetBonusPolicy(id: string, tenantId: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; targetActivationsQty: number; bonusPercent: number;
}) {
  await db.update(schema.targetBonusPolicies).set(input)
    .where(and(eq(schema.targetBonusPolicies.id, id), eq(schema.targetBonusPolicies.tenantId, tenantId), eq(schema.targetBonusPolicies.dealerId, dealerId)));
}

export async function deleteTargetBonusPolicy(id: string, tenantId: string, dealerId: string) {
  await db.delete(schema.targetBonusPolicies)
    .where(and(eq(schema.targetBonusPolicies.id, id), eq(schema.targetBonusPolicies.tenantId, tenantId), eq(schema.targetBonusPolicies.dealerId, dealerId)));
}

// ===== Stock-In =====

export interface StockInPolicyRow {
  id: string; modelId: string; modelName: string; periodStart: string;
  periodEnd: string; perUnitAmount: number; minQty: number | null;
}

export async function listStockInPolicies(tenantId: string, dealerId: string): Promise<StockInPolicyRow[]> {
  return db
    .select({ id: schema.stockInPolicies.id, modelId: schema.stockInPolicies.modelId, modelName: schema.models.name,
      periodStart: schema.stockInPolicies.periodStart, periodEnd: schema.stockInPolicies.periodEnd,
      perUnitAmount: schema.stockInPolicies.perUnitAmount, minQty: schema.stockInPolicies.minQty })
    .from(schema.stockInPolicies)
    .innerJoin(schema.models, eq(schema.models.id, schema.stockInPolicies.modelId))
    .where(and(eq(schema.stockInPolicies.tenantId, tenantId), eq(schema.stockInPolicies.dealerId, dealerId)))
    .orderBy(desc(schema.stockInPolicies.periodStart), asc(schema.models.name));
}

export async function createStockInPolicy(input: {
  tenantId: string; dealerId: string; modelId: string; periodStart: string;
  periodEnd: string; perUnitAmount: number; minQty: number | null;
}) {
  const id = randomUUID();
  await db.insert(schema.stockInPolicies).values({ id, ...input });
  return id;
}

export async function updateStockInPolicy(id: string, tenantId: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; perUnitAmount: number; minQty: number | null;
}) {
  await db.update(schema.stockInPolicies).set(input)
    .where(and(eq(schema.stockInPolicies.id, id), eq(schema.stockInPolicies.tenantId, tenantId), eq(schema.stockInPolicies.dealerId, dealerId)));
}

export async function deleteStockInPolicy(id: string, tenantId: string, dealerId: string) {
  await db.delete(schema.stockInPolicies)
    .where(and(eq(schema.stockInPolicies.id, id), eq(schema.stockInPolicies.tenantId, tenantId), eq(schema.stockInPolicies.dealerId, dealerId)));
}

// ===== Activation Incentive =====

export interface ActivationIncentivePolicyRow {
  id: string; modelId: string; modelName: string; periodStart: string;
  periodEnd: string; perUnitAmount: number; targetQty: number | null;
}

export async function listActivationIncentivePolicies(tenantId: string, dealerId: string): Promise<ActivationIncentivePolicyRow[]> {
  return db
    .select({ id: schema.activationIncentivePolicies.id, modelId: schema.activationIncentivePolicies.modelId,
      modelName: schema.models.name, periodStart: schema.activationIncentivePolicies.periodStart,
      periodEnd: schema.activationIncentivePolicies.periodEnd,
      perUnitAmount: schema.activationIncentivePolicies.perUnitAmount,
      targetQty: schema.activationIncentivePolicies.targetQty })
    .from(schema.activationIncentivePolicies)
    .innerJoin(schema.models, eq(schema.models.id, schema.activationIncentivePolicies.modelId))
    .where(and(eq(schema.activationIncentivePolicies.tenantId, tenantId), eq(schema.activationIncentivePolicies.dealerId, dealerId)))
    .orderBy(desc(schema.activationIncentivePolicies.periodStart), asc(schema.models.name));
}

export async function createActivationIncentivePolicy(input: {
  tenantId: string; dealerId: string; modelId: string; periodStart: string;
  periodEnd: string; perUnitAmount: number; targetQty: number | null;
}) {
  const id = randomUUID();
  await db.insert(schema.activationIncentivePolicies).values({ id, ...input });
  return id;
}

export async function updateActivationIncentivePolicy(id: string, tenantId: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; perUnitAmount: number; targetQty: number | null;
}) {
  await db.update(schema.activationIncentivePolicies).set(input)
    .where(and(eq(schema.activationIncentivePolicies.id, id), eq(schema.activationIncentivePolicies.tenantId, tenantId), eq(schema.activationIncentivePolicies.dealerId, dealerId)));
}

export async function deleteActivationIncentivePolicy(id: string, tenantId: string, dealerId: string) {
  await db.delete(schema.activationIncentivePolicies)
    .where(and(eq(schema.activationIncentivePolicies.id, id), eq(schema.activationIncentivePolicies.tenantId, tenantId), eq(schema.activationIncentivePolicies.dealerId, dealerId)));
}

// ===== Dealer Incentive =====

export interface DealerIncentivePolicyRow {
  id: string; modelId: string | null; modelName: string | null;
  periodStart: string; periodEnd: string; targetTotalActivations: number; perUnitAmount: number;
}

export async function listDealerIncentivePolicies(tenantId: string, dealerId: string): Promise<DealerIncentivePolicyRow[]> {
  return db
    .select({ id: schema.dealerIncentivePolicies.id, modelId: schema.dealerIncentivePolicies.modelId,
      modelName: schema.models.name, periodStart: schema.dealerIncentivePolicies.periodStart,
      periodEnd: schema.dealerIncentivePolicies.periodEnd,
      targetTotalActivations: schema.dealerIncentivePolicies.targetTotalActivations,
      perUnitAmount: schema.dealerIncentivePolicies.perUnitAmount })
    .from(schema.dealerIncentivePolicies)
    .leftJoin(schema.models, eq(schema.models.id, schema.dealerIncentivePolicies.modelId))
    .where(and(eq(schema.dealerIncentivePolicies.tenantId, tenantId), eq(schema.dealerIncentivePolicies.dealerId, dealerId)))
    .orderBy(desc(schema.dealerIncentivePolicies.periodStart), asc(schema.models.name));
}

export async function createDealerIncentivePolicy(input: {
  tenantId: string; dealerId: string; modelId?: string | null;
  periodStart: string; periodEnd: string; targetTotalActivations: number; perUnitAmount: number;
}) {
  const id = randomUUID();
  await db.insert(schema.dealerIncentivePolicies).values({ id, ...input, modelId: input.modelId ?? null });
  return id;
}

export async function updateDealerIncentivePolicy(id: string, tenantId: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; targetTotalActivations: number; perUnitAmount: number;
}) {
  await db.update(schema.dealerIncentivePolicies).set(input)
    .where(and(eq(schema.dealerIncentivePolicies.id, id), eq(schema.dealerIncentivePolicies.tenantId, tenantId), eq(schema.dealerIncentivePolicies.dealerId, dealerId)));
}

export async function deleteDealerIncentivePolicy(id: string, tenantId: string, dealerId: string) {
  await db.delete(schema.dealerIncentivePolicies)
    .where(and(eq(schema.dealerIncentivePolicies.id, id), eq(schema.dealerIncentivePolicies.tenantId, tenantId), eq(schema.dealerIncentivePolicies.dealerId, dealerId)));
}
```

- [ ] **Step 7: Rewrite lib/db/queries/transfers.ts**

Key changes: every function takes `tenantId` first; inserts include `tenantId`; `updateCrossRegionStatus` and `acceptInterIdTransfer` pass `tenantId` to `createPurchase`; `getPriceOnDate` receives `tenantId`.

```typescript
import "server-only";
import { db, schema } from "../client";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { CROSS_REGION_STATUS, INTER_ID_STATUS, PURCHASE_SOURCE } from "@/lib/constants";
import { getPriceOnDate } from "./models";

export interface CrossRegionRow {
  id: string; modelId: string; modelName: string; quantity: number;
  reportedDate: string; shiftedToIdDate: string | null; status: string; sourceRegionNote: string | null;
}

export async function listCrossRegion(tenantId: string, dealerId: string): Promise<CrossRegionRow[]> {
  return db
    .select({ id: schema.crossRegionTransfers.id, modelId: schema.crossRegionTransfers.modelId,
      modelName: schema.models.name, quantity: schema.crossRegionTransfers.quantity,
      reportedDate: schema.crossRegionTransfers.reportedDate,
      shiftedToIdDate: schema.crossRegionTransfers.shiftedToIdDate,
      status: schema.crossRegionTransfers.status, sourceRegionNote: schema.crossRegionTransfers.sourceRegionNote })
    .from(schema.crossRegionTransfers)
    .innerJoin(schema.models, eq(schema.models.id, schema.crossRegionTransfers.modelId))
    .where(and(eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.dealerId, dealerId)))
    .orderBy(desc(schema.crossRegionTransfers.reportedDate));
}

export async function countPendingCrossRegion(tenantId: string, dealerId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.dealerId, dealerId), eq(schema.crossRegionTransfers.status, CROSS_REGION_STATUS.PENDING_REPORT)));
  return Number(n);
}

export async function createCrossRegion(input: {
  tenantId: string; dealerId: string; modelId: string; quantity: number;
  reportedDate: string; sourceRegionNote: string | null;
}) {
  const id = randomUUID();
  await db.insert(schema.crossRegionTransfers).values({ id, ...input, shiftedToIdDate: null, status: CROSS_REGION_STATUS.PENDING_REPORT });
  return id;
}

export async function updateCrossRegionStatus(input: {
  id: string; tenantId: string; dealerId: string; status: "PENDING_REPORT" | "SHIFTED_TO_MY_ID" | "REJECTED";
}) {
  const rows = await db.select().from(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.id, input.id), eq(schema.crossRegionTransfers.tenantId, input.tenantId), eq(schema.crossRegionTransfers.dealerId, input.dealerId)))
    .limit(1);
  if (rows.length === 0) return { ok: false, message: "Not found" };
  const transfer = rows[0];
  const today = new Date().toISOString().slice(0, 10);

  if (input.status === CROSS_REGION_STATUS.SHIFTED_TO_MY_ID) {
    if (transfer.status !== CROSS_REGION_STATUS.PENDING_REPORT) return { ok: false, message: "Only pending transfers can be shifted" };
    const price = await getPriceOnDate(input.tenantId, transfer.modelId, today);
    if (!price) return { ok: false, message: "No dealer price defined for this model" };
    await db.insert(schema.purchases).values({
      id: randomUUID(), tenantId: input.tenantId, dealerId: transfer.dealerId,
      modelId: transfer.modelId, quantity: transfer.quantity,
      unitDealerPrice: price.dealerPrice, unitInvoicePrice: price.invoicePrice,
      purchaseDate: today, source: PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN,
      referenceNote: `Cross-region: ${transfer.sourceRegionNote ?? "—"}`,
      crossRegionTransferId: transfer.id,
    });
    await db.update(schema.crossRegionTransfers).set({ status: input.status, shiftedToIdDate: today }).where(eq(schema.crossRegionTransfers.id, transfer.id));
    return { ok: true, created: transfer.quantity };
  }

  await db.update(schema.crossRegionTransfers).set({ status: input.status }).where(eq(schema.crossRegionTransfers.id, transfer.id));
  return { ok: true };
}

export async function deleteCrossRegion(id: string, tenantId: string, dealerId: string) {
  await db.delete(schema.purchases)
    .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId), eq(schema.purchases.crossRegionTransferId, id)));
  await db.delete(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.id, id), eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.dealerId, dealerId)));
}

export interface InterIdRow {
  id: string; fromDealerId: string; toDealerId: string; modelId: string;
  modelName: string; quantity: number; transferDate: string; note: string | null; status: string;
}

export interface PendingTransferRow {
  id: string; fromDealerId: string; fromDealerName: string; modelId: string;
  modelName: string; quantity: number; transferDate: string; note: string | null;
}

export async function listInterIdTransfers(tenantId: string, dealerId: string): Promise<InterIdRow[]> {
  return db
    .select({ id: schema.interIdTransfers.id, fromDealerId: schema.interIdTransfers.fromDealerId,
      toDealerId: schema.interIdTransfers.toDealerId, modelId: schema.interIdTransfers.modelId,
      modelName: schema.models.name, quantity: schema.interIdTransfers.quantity,
      transferDate: schema.interIdTransfers.transferDate, note: schema.interIdTransfers.note,
      status: schema.interIdTransfers.status })
    .from(schema.interIdTransfers)
    .innerJoin(schema.models, eq(schema.models.id, schema.interIdTransfers.modelId))
    .where(and(eq(schema.interIdTransfers.tenantId, tenantId), or(eq(schema.interIdTransfers.fromDealerId, dealerId), eq(schema.interIdTransfers.toDealerId, dealerId))))
    .orderBy(desc(schema.interIdTransfers.transferDate));
}

export async function listPendingInbound(tenantId: string, toDealerId: string): Promise<PendingTransferRow[]> {
  return db
    .select({ id: schema.interIdTransfers.id, fromDealerId: schema.interIdTransfers.fromDealerId,
      fromDealerName: schema.dealerIds.name, modelId: schema.interIdTransfers.modelId,
      modelName: schema.models.name, quantity: schema.interIdTransfers.quantity,
      transferDate: schema.interIdTransfers.transferDate, note: schema.interIdTransfers.note })
    .from(schema.interIdTransfers)
    .innerJoin(schema.models, eq(schema.models.id, schema.interIdTransfers.modelId))
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.interIdTransfers.fromDealerId))
    .where(and(eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.toDealerId, toDealerId), eq(schema.interIdTransfers.status, INTER_ID_STATUS.PENDING)))
    .orderBy(desc(schema.interIdTransfers.transferDate));
}

export async function createInterIdTransfer(input: {
  tenantId: string; fromDealerId: string; toDealerId: string; modelId: string;
  quantity: number; transferDate: string; note: string | null;
}) {
  if (input.fromDealerId === input.toDealerId) throw new Error("Source and destination must be different dealer IDs");
  const id = randomUUID();
  await db.insert(schema.interIdTransfers).values({ id, ...input, status: INTER_ID_STATUS.PENDING });
  return id;
}

export async function acceptInterIdTransfer(tenantId: string, id: string, toDealerId: string): Promise<{ ok: boolean; message?: string }> {
  const rows = await db.select().from(schema.interIdTransfers)
    .where(and(eq(schema.interIdTransfers.id, id), eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.toDealerId, toDealerId)))
    .limit(1);
  if (rows.length === 0) return { ok: false, message: "Transfer not found" };
  const transfer = rows[0];
  if (transfer.status !== INTER_ID_STATUS.PENDING) return { ok: false, message: "Transfer is not pending" };
  const price = await getPriceOnDate(tenantId, transfer.modelId, transfer.transferDate);
  if (!price) return { ok: false, message: "No dealer price defined for this model on the transfer date" };
  await db.insert(schema.purchases).values({
    id: randomUUID(), tenantId, dealerId: toDealerId, modelId: transfer.modelId,
    quantity: transfer.quantity, unitDealerPrice: price.dealerPrice, unitInvoicePrice: price.invoicePrice,
    purchaseDate: transfer.transferDate, source: PURCHASE_SOURCE.REGULAR,
    referenceNote: `Inter-ID transfer in (${id.slice(0, 8)})`,
  });
  await db.update(schema.interIdTransfers).set({ status: INTER_ID_STATUS.ACCEPTED }).where(eq(schema.interIdTransfers.id, id));
  return { ok: true };
}

export async function rejectInterIdTransfer(tenantId: string, id: string, toDealerId: string): Promise<{ ok: boolean; message?: string }> {
  const rows = await db.select().from(schema.interIdTransfers)
    .where(and(eq(schema.interIdTransfers.id, id), eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.toDealerId, toDealerId)))
    .limit(1);
  if (rows.length === 0) return { ok: false, message: "Transfer not found" };
  if (rows[0].status !== INTER_ID_STATUS.PENDING) return { ok: false, message: "Transfer is not pending" };
  await db.update(schema.interIdTransfers).set({ status: INTER_ID_STATUS.REJECTED }).where(eq(schema.interIdTransfers.id, id));
  return { ok: true };
}
```

- [ ] **Step 8: Commit**

```powershell
git add lib/db/queries/
git commit -m "queries: add tenantId param to all scoped query functions"
```

---

### Task 7: Update owner actions + lib/dealer.ts to pass tenantId

**Files:**
- Modify: `lib/dealer.ts`
- Modify: `app/(app)/activations/actions.ts`
- Modify: `app/(app)/purchases/actions.ts`
- Modify: `app/(app)/cross-region/actions.ts`
- Modify: `app/(app)/ids/actions.ts`
- Modify: `app/(app)/inventory/actions.ts`
- Modify: `app/(app)/models/actions.ts`
- Modify: `app/(app)/policies/actions.ts`
- Modify: `app/(app)/dashboard/actions.ts`

- [ ] **Step 1: Add OWNER_TENANT_ID to lib/dealer.ts**

At the top of `lib/dealer.ts` after the imports, add:

```typescript
export const OWNER_TENANT_ID = "owner";
```

Also update `listDealerIds` to filter by tenant for future use (owner sees only their dealer IDs):

```typescript
export async function listDealerIds() {
  return db
    .select()
    .from(schema.dealerIds)
    .where(eq(schema.dealerIds.tenantId, OWNER_TENANT_ID))
    .orderBy(asc(schema.dealerIds.name));
}
```

- [ ] **Step 2: Update app/(app)/activations/actions.ts**

Every call to `createActivation`, `deleteActivation`, `getStockForModelAsOf`, `getPriceOnDate` needs `tenantId`. Import `OWNER_TENANT_ID` and thread it through. Key diffs:

```typescript
// Add import
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";

// In createActivationAction, after getting dealerId:
const tenantId = OWNER_TENANT_ID;

// Update createActivation call:
await createActivation({ tenantId, dealerId, modelId: data.modelId, ... });

// Update getStockForModelAsOf calls:
const stock = await getStockForModelAsOf(tenantId, dealerId, data.modelId, data.activationDate);

// Update getPriceOnDate call:
const price = await getPriceOnDate(tenantId, data.modelId, data.activationDate);

// Update deleteActivation calls:
await deleteActivation(id, dealerId, tenantId);
```

Apply the same `const tenantId = OWNER_TENANT_ID;` + threaded param pattern to `bulkCreateActivationsByDateAction`, `deleteActivationAction`, and `bulkDeleteActivationsAction`.

- [ ] **Step 3: Update remaining action files**

For each file below, add `import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer"`, add `const tenantId = OWNER_TENANT_ID;` after obtaining `dealerId`, and update every query function call to pass `tenantId` as first param:

- `app/(app)/purchases/actions.ts` — `createPurchase`, `deletePurchase`, `getStockForModel`, `getStockForModelAsOf`
- `app/(app)/cross-region/actions.ts` — `createCrossRegion`, `updateCrossRegionStatus`, `deleteCrossRegion`, `countPendingCrossRegion`, `listCrossRegion`
- `app/(app)/ids/actions.ts` — any `dealerIds` mutations; add `tenantId: OWNER_TENANT_ID` to inserts
- `app/(app)/inventory/actions.ts` — `listInventoryForDealer`
- `app/(app)/models/actions.ts` — `createModel(tenantId, input)`, `updateModelPrice(tenantId, input)`, `addPriceEntry(tenantId, input)`, `updatePriceEntry(tenantId, input)`, `deletePriceEntry(tenantId, input)`, `listModelsWithCurrentPrice(tenantId)`
- `app/(app)/policies/actions.ts` — all policy CRUD functions
- `app/(app)/dashboard/actions.ts` — this file uses raw db queries directly; add `eq(schema.activations.tenantId, OWNER_TENANT_ID)` to every WHERE clause

- [ ] **Step 4: Update page-level data fetching**

Any server component that calls query functions directly (e.g. `app/(app)/activations/page.tsx`, `app/(app)/inventory/page.tsx`) needs to pass `OWNER_TENANT_ID`. Find all such calls:

```powershell
Select-String -Path "app\(app)\**\*.tsx","app\(app)\**\*.ts" -Pattern "listActivations|listPurchases|listInventory|listCrossRegion|listInterIdTransfers|listCrCaught|listModels|listTargetBonus|listStockIn|listActivationIncentive|listDealerIncentive" -Recurse
```

For each match, add `OWNER_TENANT_ID` as the first argument.

- [ ] **Step 5: Fix incentive-engine loader if needed**

```powershell
Select-String -Path "lib\incentive-engine\**" -Pattern "getPriceOnDate|listActivations|listPurchases" -Recurse
```

If any incentive-engine function calls query functions, update them to pass `OWNER_TENANT_ID`.

- [ ] **Step 6: Commit**

```powershell
git add app/ lib/dealer.ts
git commit -m "feat(phase1): thread tenantId through all owner actions and page queries"
```

---

### Task 8: Type-check, run dev, verify owner flow

**Files:** none

- [ ] **Step 1: Run TypeScript check**

```powershell
npx tsc --noEmit
```

Fix any remaining type errors. Common issues:
- Missing `tenantId` arg in a query call → add `OWNER_TENANT_ID`
- Old `deleteActivation(id, dealerId)` signature → update to `deleteActivation(id, dealerId, tenantId)`
- `getPriceOnDate(modelId, date)` → `getPriceOnDate(tenantId, modelId, date)`

- [ ] **Step 2: Run dev server**

```powershell
npm run dev
```

Visit http://localhost:3000/unlock, enter PIN, check:
- Dashboard loads with data
- Activations page loads
- Can add an activation
- Can view inventory

- [ ] **Step 3: Run existing tests**

```powershell
npm test
```

Expected: all incentive-engine tests pass.

- [ ] **Step 4: Final Phase 1 commit**

```powershell
git add -A
git commit -m "feat: Phase 1 complete — Postgres migration with full tenant isolation"
```

**Phase 1 done.** Verify with: `npm run build` → 0 errors. Owner flow at /unlock unchanged.

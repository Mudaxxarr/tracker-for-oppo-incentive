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
  features: text("features").notNull().default("{}"),
  backdateDays: integer("backdate_days").notNull().default(3),
  purchaseApprovalThreshold: integer("purchase_approval_threshold"), // null = disabled
  monthlyFee: real("monthly_fee"), // null = unset
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
    lowStockThreshold: integer("low_stock_threshold"), // null = no alert
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
    reviewStatus: text("review_status").notNull().default("active"), // 'active'|'pending_review'|'approved'
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
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
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
    status: text("status").notNull().default("active"), // 'active' | 'pending_owner_approval'
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("crc_by_dealer").on(t.tenantId, t.dealerId, t.caughtDate),
  })
);

// ---------- Customers ----------
export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => dealerTenants.id, { onDelete: "cascade" }),
    dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    cnic: text("cnic"),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("customers_by_dealer").on(t.tenantId, t.dealerId, t.createdAt),
    byPhone: index("customers_by_phone").on(t.tenantId, t.dealerId, t.phone),
  })
);

// ---------- Warranty Claims ----------
export const warrantyClaims = pgTable(
  "warranty_claims",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => dealerTenants.id, { onDelete: "cascade" }),
    dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    activationId: text("activation_id").references(() => activations.id, { onDelete: "set null" }),
    modelId: text("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
    issueDesc: text("issue_desc").notNull(),
    status: text("status").notNull().default("pending"), // pending|in_repair|resolved|rejected
    createdAt: isoDateTime("created_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (t) => ({
    byDealer: index("warranty_by_dealer").on(t.tenantId, t.dealerId, t.createdAt),
    byStatus: index("warranty_by_status").on(t.tenantId, t.status, t.createdAt),
  })
);

// ---------- Sales Scripts (global — owner manages, all dealers read) ----------
export const scripts = pgTable("scripts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: isoDateTime("created_at").notNull(),
});

// ---------- Owner Alerts ----------
export const ownerAlerts = pgTable(
  "owner_alerts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => dealerTenants.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // OWNER_ALERT_TYPE values
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    dealerId: text("dealer_id"),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byTenant: index("owner_alerts_by_tenant").on(t.tenantId, t.isRead, t.createdAt),
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

// ---------- Rebates (price-cut adjustment per dealer) ----------
export const rebates = pgTable(
  "rebates",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => dealerTenants.id, { onDelete: "cascade" }),
    dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
    oldDealerPrice: real("old_dealer_price").notNull(),
    newDealerPrice: real("new_dealer_price").notNull(),
    rebatePerUnit: real("rebate_per_unit").notNull(),
    eligibleQty: integer("eligible_qty").notNull(),
    totalRebateAmount: real("total_rebate_amount").notNull(),
    rebateDate: isoDate("rebate_date").notNull(),
    priceHistoryId: text("price_history_id"),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    byDealer: index("rebates_by_dealer").on(t.tenantId, t.dealerId, t.rebateDate),
    byModel: index("rebates_by_model").on(t.tenantId, t.modelId, t.rebateDate),
  })
);

// ---------- Owner Staff (SO / Accountant for owner portal) ----------
export const ownerStaff = pgTable("owner_staff", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("so"), // 'so' | 'accountant'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: isoDateTime("created_at").notNull(),
});

// ---------- Dealer Daily Backups ----------
export const dealerDailyBackups = pgTable(
  "dealer_daily_backups",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => dealerTenants.id, { onDelete: "cascade" }),
    backupDate: text("backup_date").notNull(),
    data: text("data").notNull(),
    createdAt: isoDateTime("created_at").notNull(),
  },
  (t) => ({
    uniqTenantDate: uniqueIndex("dealer_daily_backups_tenant_date").on(t.tenantId, t.backupDate),
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
export type OwnerAlert = typeof ownerAlerts.$inferSelect;
export type NewOwnerAlert = typeof ownerAlerts.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type WarrantyClaim = typeof warrantyClaims.$inferSelect;
export type NewWarrantyClaim = typeof warrantyClaims.$inferInsert;
export type Script = typeof scripts.$inferSelect;
export type NewScript = typeof scripts.$inferInsert;
export type Rebate = typeof rebates.$inferSelect;
export type NewRebate = typeof rebates.$inferInsert;
export type OwnerStaff = typeof ownerStaff.$inferSelect;
export type NewOwnerStaff = typeof ownerStaff.$inferInsert;

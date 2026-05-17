import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

/**
 * Schema designed to be Postgres-compatible:
 * - Money stored as REAL/numeric (PKR has 0 fractional digits in practice; but keep room).
 * - Dates stored as ISO `YYYY-MM-DD` strings to avoid timezone drift across SQLite/Postgres.
 * - Timestamps use ISO datetime strings.
 * - All FKs are explicit; cascade rules make purchase/activation cleanup safe.
 */

const isoDate = (name: string) => text(name);
const isoDateTime = (name: string) =>
  text(name).default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

// ---------- Dealer IDs ----------
export const dealerIds = sqliteTable("dealer_ids", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  note: text("note"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: isoDateTime("created_at").notNull(),
});

// ---------- Models ----------
export const models = sqliteTable("models", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  uniqueName: uniqueIndex("models_name_unique").on(t.name),
}));

// ---------- Model price history ----------
// effective_to is null for the currently-active row.
export const modelPriceHistory = sqliteTable("model_price_history", {
  id: text("id").primaryKey(),
  modelId: text("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
  dealerPrice: real("dealer_price").notNull(),
  invoicePrice: real("invoice_price").notNull(),
  effectiveFrom: isoDate("effective_from").notNull(),
  effectiveTo: isoDate("effective_to"),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byModel: index("mph_by_model").on(t.modelId, t.effectiveFrom),
}));

// ---------- Purchases ----------
export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  unitDealerPrice: real("unit_dealer_price").notNull(),
  unitInvoicePrice: real("unit_invoice_price").notNull(),
  purchaseDate: isoDate("purchase_date").notNull(),
  source: text("source").notNull(), // 'REGULAR' | 'CROSS_REGION_TRANSFER_IN'
  referenceNote: text("reference_note"),
  // If source is CROSS_REGION_TRANSFER_IN, link back to the cross_region_transfers row.
  crossRegionTransferId: text("cross_region_transfer_id"),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byDealer: index("purchases_by_dealer").on(t.dealerId, t.purchaseDate),
  byModel: index("purchases_by_model").on(t.modelId, t.purchaseDate),
}));

// ---------- Activations ----------
export const activations = sqliteTable("activations", {
  id: text("id").primaryKey(),
  dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
  purchaseId: text("purchase_id").references(() => purchases.id, { onDelete: "set null" }),
  imei: text("imei"),
  activationDate: isoDate("activation_date").notNull(),
  // Locked snapshot at the moment of activation; never changes when prices update later.
  dealerPriceSnapshot: real("dealer_price_snapshot").notNull(),
  // Marks activations of phones that came in via cross-region transfer.
  isCrossRegion: integer("is_cross_region", { mode: "boolean" }).notNull().default(false),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byDealer: index("activations_by_dealer").on(t.dealerId, t.activationDate),
  byModel: index("activations_by_model").on(t.modelId, t.activationDate),
  byImei: uniqueIndex("activations_imei_unique").on(t.imei),
}));

// ---------- Policies ----------
// b) Target Bonus
export const targetBonusPolicies = sqliteTable("target_bonus_policies", {
  id: text("id").primaryKey(),
  dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
  periodStart: isoDate("period_start").notNull(),
  periodEnd: isoDate("period_end").notNull(),
  targetActivationsQty: integer("target_activations_qty").notNull(),
  bonusPercent: real("bonus_percent").notNull().default(1),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byDealer: index("tbp_by_dealer").on(t.dealerId, t.periodStart),
}));

// c) Stock-In (per model, per period)
export const stockInPolicies = sqliteTable("stock_in_policies", {
  id: text("id").primaryKey(),
  dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
  periodStart: isoDate("period_start").notNull(),
  periodEnd: isoDate("period_end").notNull(),
  perUnitAmount: real("per_unit_amount").notNull(),
  minQty: integer("min_qty"),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byDealer: index("sip_by_dealer").on(t.dealerId, t.periodStart),
  byModel: index("sip_by_model").on(t.modelId, t.periodStart),
}));

// d) Activation Incentive (per model, per period)
export const activationIncentivePolicies = sqliteTable("activation_incentive_policies", {
  id: text("id").primaryKey(),
  dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
  periodStart: isoDate("period_start").notNull(),
  periodEnd: isoDate("period_end").notNull(),
  perUnitAmount: real("per_unit_amount").notNull(),
  targetQty: integer("target_qty"),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byDealer: index("aip_by_dealer").on(t.dealerId, t.periodStart),
  byModel: index("aip_by_model").on(t.modelId, t.periodStart),
}));

// e) Dealer Incentive (global activation target, or per-model when modelId is set)
export const dealerIncentivePolicies = sqliteTable("dealer_incentive_policies", {
  id: text("id").primaryKey(),
  dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
  // When set, this entry tracks incentive for a specific model; null = global target.
  modelId: text("model_id").references(() => models.id, { onDelete: "restrict" }),
  periodStart: isoDate("period_start").notNull(),
  periodEnd: isoDate("period_end").notNull(),
  targetTotalActivations: integer("target_total_activations").notNull(),
  perUnitAmount: real("per_unit_amount").notNull(),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byDealer: index("dip_by_dealer").on(t.dealerId, t.periodStart),
}));

// ---------- Cross-Region Transfers ----------
export const crossRegionTransfers = sqliteTable("cross_region_transfers", {
  id: text("id").primaryKey(),
  dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  reportedDate: isoDate("reported_date").notNull(),
  shiftedToIdDate: isoDate("shifted_to_id_date"),
  sourceRegionNote: text("source_region_note"),
  status: text("status").notNull(), // PENDING_REPORT | SHIFTED_TO_MY_ID | REJECTED
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byDealer: index("crt_by_dealer").on(t.dealerId, t.reportedDate),
}));

// ---------- Inter-ID Transfers (between user's own dealer IDs) ----------
export const interIdTransfers = sqliteTable("inter_id_transfers", {
  id: text("id").primaryKey(),
  fromDealerId: text("from_dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
  toDealerId: text("to_dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  transferDate: isoDate("transfer_date").notNull(),
  note: text("note"),
  // PENDING = awaiting acceptance by toDealerId, ACCEPTED = stock added to destination, REJECTED = declined
  // Default ACCEPTED keeps pre-existing rows valid without migration.
  status: text("status").notNull().default("ACCEPTED"),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byFrom: index("iit_by_from").on(t.fromDealerId, t.transferDate),
  byTo: index("iit_by_to").on(t.toDealerId, t.transferDate),
}));

// ---------- CR Caught (competitor activated dealer's phone cross-region) ----------
export const crCaught = sqliteTable("cr_caught", {
  id: text("id").primaryKey(),
  dealerId: text("dealer_id").notNull().references(() => dealerIds.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  caughtDate: isoDate("caught_date").notNull(),
  dealerPriceSnapshot: real("dealer_price_snapshot").notNull(),
  note: text("note"),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byDealer: index("crc_by_dealer").on(t.dealerId, t.caughtDate),
}));

// ---------- App settings (single-row key/value config) ----------
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: isoDateTime("updated_at").notNull(),
});

// ---------- Audit log (every user action) ----------
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  // Action verb in dot-notation: 'auth.unlock', 'purchase.create', 'policy.delete', etc.
  action: text("action").notNull(),
  // Active dealer ID at the time (nullable for auth events)
  dealerId: text("dealer_id"),
  // Logical entity touched: 'purchase', 'activation', 'policy', etc. (nullable)
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  // Outcome: 'ok' | 'error'
  status: text("status").notNull().default("ok"),
  // JSON-encoded details (qty, model name, price, error message, etc.)
  payload: text("payload"),
  // Free-text human summary for the activity feed
  summary: text("summary").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: isoDateTime("created_at").notNull(),
}, (t) => ({
  byDealer: index("audit_by_dealer").on(t.dealerId, t.createdAt),
  byAction: index("audit_by_action").on(t.action, t.createdAt),
  byCreated: index("audit_by_created").on(t.createdAt),
}));

// ----- Type exports -----
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
export type DealerIncentivePolicy = typeof dealerIncentivePolicies.$inferSelect & { modelId?: string | null };
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

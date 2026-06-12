import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, schema } from "@/lib/db/client";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import {
  type DealerFeatures,
  parseDealerFeatures,
  BASE_PLAN_FEATURES,
} from "@/lib/dealer-features";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { seedDealerPricesFromOwner } from "@/lib/db/queries/models";

export interface TenantListRow {
  id: string;
  businessName: string;
  ownerEmail: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  userCount: number;
}

export interface TenantDetail {
  id: string;
  businessName: string;
  ownerEmail: string;
  planMonths: number;
  startedAt: string;
  expiresAt: string;
  status: string;
  monthlyFee: number | null;
  createdAt: string;
  features: DealerFeatures;
  users: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }[];
}

export interface CreateTenantInput {
  businessName: string;
  ownerEmail: string;
  planMonths: number;
  adminEmail: string;
}

export interface CreateTenantResult {
  tenantId: string;
  userId: string;
  tempPassword: string;
}

export async function listTenants(): Promise<TenantListRow[]> {
  const userCounts = db
    .select({
      tenantId: schema.dealerUsers.tenantId,
      n: count().as("n"),
    })
    .from(schema.dealerUsers)
    .groupBy(schema.dealerUsers.tenantId)
    .as("uc");

  const rows = await db
    .select({
      id: schema.dealerTenants.id,
      businessName: schema.dealerTenants.businessName,
      ownerEmail: schema.dealerTenants.ownerEmail,
      status: schema.dealerTenants.status,
      expiresAt: schema.dealerTenants.expiresAt,
      createdAt: schema.dealerTenants.createdAt,
      userCount: sql<number>`coalesce(${userCounts.n}, 0)`,
    })
    .from(schema.dealerTenants)
    .leftJoin(userCounts, eq(userCounts.tenantId, schema.dealerTenants.id))
    .where(sql`${schema.dealerTenants.id} != 'owner'`)
    .orderBy(desc(schema.dealerTenants.createdAt));

  return rows.map((r) => ({ ...r, userCount: Number(r.userCount) }));
}

export interface TenantFeatureRow {
  id: string;
  businessName: string;
  status: string;
  features: DealerFeatures;
}

// Tenant × feature matrix for the staged-rollout console.
export async function listTenantFeatureMatrix(): Promise<TenantFeatureRow[]> {
  const rows = await db
    .select({
      id: schema.dealerTenants.id,
      businessName: schema.dealerTenants.businessName,
      status: schema.dealerTenants.status,
      features: schema.dealerTenants.features,
    })
    .from(schema.dealerTenants)
    .where(sql`${schema.dealerTenants.id} != 'owner'`)
    .orderBy(asc(schema.dealerTenants.businessName));

  return rows.map((r) => ({ ...r, features: parseDealerFeatures(r.features) }));
}

// Set one flag across many tenants; merges into each tenant's existing JSON.
export async function bulkSetFeature(
  key: string,
  enabled: boolean,
  tenantIds: string[],
): Promise<void> {
  for (const tenantId of tenantIds) {
    const features = await getTenantFeaturesById(tenantId);
    (features as Record<string, boolean>)[key] = enabled;
    await updateDealerFeatures(tenantId, features);
  }
}

export async function getTenantById(id: string): Promise<TenantDetail | null> {
  const tenantRows = await db
    .select()
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, id))
    .limit(1);

  if (tenantRows.length === 0) return null;
  const tenant = tenantRows[0];

  const userRows = await db
    .select({
      id: schema.dealerUsers.id,
      email: schema.dealerUsers.email,
      role: schema.dealerUsers.role,
      isActive: schema.dealerUsers.isActive,
      createdAt: schema.dealerUsers.createdAt,
    })
    .from(schema.dealerUsers)
    .where(eq(schema.dealerUsers.tenantId, id))
    .orderBy(asc(schema.dealerUsers.email));

  return {
    ...tenant,
    features: parseDealerFeatures(tenant.features),
    users: userRows,
  };
}

export async function updateDealerFeatures(
  tenantId: string,
  features: DealerFeatures,
): Promise<void> {
  await db
    .update(schema.dealerTenants)
    .set({ features: JSON.stringify(features) })
    .where(eq(schema.dealerTenants.id, tenantId));

  await logAudit({
    action: "admin_dealer_features_updated",
    summary: `Updated feature flags for tenant ${tenantId}`,
    entityType: "dealer_tenant",
    entityId: tenantId,
    payload: { features },
  });
}

export async function createTenant(
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const now = new Date().toISOString();
  const startedAt = now.slice(0, 10);
  const expiresAt = addMonths(startedAt, input.planMonths);

  await db.insert(schema.dealerTenants).values({
    id: tenantId,
    businessName: input.businessName.trim(),
    ownerEmail: input.ownerEmail.toLowerCase().trim(),
    planMonths: input.planMonths,
    startedAt,
    expiresAt,
    status: "active",
    features: JSON.stringify(BASE_PLAN_FEATURES),
    createdAt: now,
  });

  await db.insert(schema.dealerUsers).values({
    id: userId,
    tenantId,
    email: input.adminEmail.toLowerCase().trim(),
    passwordHash,
    role: "admin",
    isActive: true,
    createdAt: now,
  });

  // Seed the new tenant with current owner catalog prices so they see prices immediately
  await seedDealerPricesFromOwner(OWNER_TENANT_ID, tenantId);

  await logAudit({
    action: "admin_tenant_created",
    summary: `Created dealer tenant: ${input.businessName}`,
    entityType: "dealer_tenant",
    entityId: tenantId,
    payload: { businessName: input.businessName, adminEmail: input.adminEmail, planMonths: input.planMonths },
  });

  return { tenantId, userId, tempPassword };
}

export async function renewTenant(id: string, months: number): Promise<void> {
  const rows = await db
    .select({ expiresAt: schema.dealerTenants.expiresAt, status: schema.dealerTenants.status })
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, id))
    .limit(1);

  if (rows.length === 0) throw new Error(`Tenant ${id} not found`);

  const current = rows[0];
  const base =
    current.status === "expired" || current.expiresAt < new Date().toISOString().slice(0, 10)
      ? new Date().toISOString().slice(0, 10)
      : current.expiresAt;

  const newExpiry = addMonths(base, months);

  await db
    .update(schema.dealerTenants)
    .set({ expiresAt: newExpiry, status: "active" })
    .where(eq(schema.dealerTenants.id, id));

  await logAudit({
    action: "admin_tenant_renewed",
    summary: `Renewed tenant ${id} by ${months} months to ${newExpiry}`,
    entityType: "dealer_tenant",
    entityId: id,
    payload: { months, newExpiry },
  });
}

export interface RevenueTenantRow {
  id: string;
  businessName: string;
  ownerEmail: string;
  status: string;
  expiresAt: string;
  planMonths: number;
  monthlyFee: number | null;
}

export async function getRevenueSummary() {
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = addDays(today, 7);
  const in30Days = addDays(today, 30);
  const monthStart = today.slice(0, 7) + "-01";

  const [rows, collectedRows] = await Promise.all([
    db
      .select({
        id: schema.dealerTenants.id,
        businessName: schema.dealerTenants.businessName,
        ownerEmail: schema.dealerTenants.ownerEmail,
        status: schema.dealerTenants.status,
        expiresAt: schema.dealerTenants.expiresAt,
        planMonths: schema.dealerTenants.planMonths,
        monthlyFee: schema.dealerTenants.monthlyFee,
      })
      .from(schema.dealerTenants)
      .where(sql`${schema.dealerTenants.id} != 'owner'`)
      .orderBy(schema.dealerTenants.expiresAt),
    db
      .select({ total: sql<number>`COALESCE(SUM(${schema.billingEvents.amount}), 0)` })
      .from(schema.billingEvents)
      .where(sql`${schema.billingEvents.paidAt} >= ${monthStart}`),
  ]);

  const collectedThisMonth = Number(collectedRows[0]?.total ?? 0);

  let active = 0, expiringIn7 = 0, expiringSoon = 0, grace = 0, expired = 0, suspended = 0;
  let mrr = 0;

  for (const row of rows) {
    if (row.status === "suspended") { suspended++; continue; }
    if (row.status === "grace") { grace++; continue; }
    if (row.status === "expired") { expired++; continue; }
    active++;
    mrr += row.monthlyFee ?? 0;
    if (row.expiresAt <= in7Days) expiringIn7++;
    if (row.expiresAt <= in30Days) expiringSoon++;
  }

  return {
    total: rows.length,
    active,
    expiringIn7,
    expiringSoon,
    grace,
    collectedThisMonth,
    expired,
    suspended,
    mrr,
    arr: mrr * 12,
    tenants: rows as RevenueTenantRow[],
  };
}

export async function resetDealerUserPassword(
  userId: string,
): Promise<{ email: string; tempPassword: string }> {
  const rows = await db
    .select({ email: schema.dealerUsers.email, tenantId: schema.dealerUsers.tenantId })
    .from(schema.dealerUsers)
    .where(eq(schema.dealerUsers.id, userId))
    .limit(1);

  if (rows.length === 0) throw new Error(`Dealer user ${userId} not found`);

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await db
    .update(schema.dealerUsers)
    .set({ passwordHash })
    .where(eq(schema.dealerUsers.id, userId));

  await logAudit({
    action: "admin_dealer_password_reset",
    summary: `Reset password for dealer user ${rows[0].email}`,
    entityType: "dealer_user",
    entityId: userId,
    payload: { email: rows[0].email },
  });

  return { email: rows[0].email, tempPassword };
}

export interface DealerSettings {
  backdateDays: number;
  purchaseApprovalThreshold: number | null;
}

export async function getDealerSettings(tenantId: string): Promise<DealerSettings | null> {
  const rows = await db
    .select({
      backdateDays: schema.dealerTenants.backdateDays,
      purchaseApprovalThreshold: schema.dealerTenants.purchaseApprovalThreshold,
    })
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, tenantId))
    .limit(1);
  if (rows.length === 0) return null;
  return rows[0];
}

export async function updateDealerSettings(
  tenantId: string,
  settings: DealerSettings,
): Promise<void> {
  await db
    .update(schema.dealerTenants)
    .set({
      backdateDays: settings.backdateDays,
      purchaseApprovalThreshold: settings.purchaseApprovalThreshold,
    })
    .where(eq(schema.dealerTenants.id, tenantId));

  await logAudit({
    action: "admin_dealer_settings_updated",
    summary: `Updated policy settings for tenant ${tenantId}`,
    entityType: "dealer_tenant",
    entityId: tenantId,
    payload: settings,
  });
}

export async function getTenantFeaturesById(tenantId: string): Promise<DealerFeatures> {
  const rows = await db
    .select({ features: schema.dealerTenants.features })
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, tenantId))
    .limit(1);
  return parseDealerFeatures(rows[0]?.features ?? "{}");
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => chars[b % chars.length]).join("");
}

// ── Dealer Team Management ────────────────────────────────────────────────────

export { DEALER_TEAM_LIMIT } from "@/lib/constants";
import { DEALER_TEAM_LIMIT } from "@/lib/constants";

export interface DealerTeamMember {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export async function listDealerTeamMembers(tenantId: string): Promise<DealerTeamMember[]> {
  const rows = await db
    .select({ id: schema.dealerUsers.id, email: schema.dealerUsers.email, role: schema.dealerUsers.role, isActive: schema.dealerUsers.isActive, createdAt: schema.dealerUsers.createdAt })
    .from(schema.dealerUsers)
    .where(eq(schema.dealerUsers.tenantId, tenantId))
    .orderBy(schema.dealerUsers.createdAt);
  return rows.map((r) => ({ ...r, createdAt: String(r.createdAt) }));
}

export async function addDealerTeamMember(
  tenantId: string,
  email: string,
  password: string,
): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  const [{ total }] = await db.select({ total: count() }).from(schema.dealerUsers).where(eq(schema.dealerUsers.tenantId, tenantId));
  if (Number(total) >= DEALER_TEAM_LIMIT) return { ok: false, error: `Maximum ${DEALER_TEAM_LIMIT} team members allowed per dealer` };

  const normalEmail = email.trim().toLowerCase();
  const existing = await db.select({ id: schema.dealerUsers.id }).from(schema.dealerUsers).where(eq(schema.dealerUsers.email, normalEmail)).limit(1);
  if (existing.length > 0) return { ok: false, error: "Email already in use" };

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = randomUUID();
  await db.insert(schema.dealerUsers).values({ id: userId, tenantId, email: normalEmail, passwordHash, role: "exec", isActive: true });

  await logAudit({
    action: "admin_dealer_team_member_added",
    summary: `Added exec team member ${normalEmail} to tenant ${tenantId}`,
    entityType: "dealer_user",
    entityId: userId,
    payload: { email: normalEmail, tenantId },
  });

  return { ok: true, tempPassword: password };
}

export async function toggleDealerTeamMemberActive(userId: string, isActive: boolean): Promise<void> {
  await db.update(schema.dealerUsers).set({ isActive }).where(eq(schema.dealerUsers.id, userId));
}

export async function deleteDealerTeamMember(
  userId: string,
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await db.select({ role: schema.dealerUsers.role }).from(schema.dealerUsers).where(eq(schema.dealerUsers.id, userId)).limit(1);
  if (rows.length === 0) return { ok: false, error: "User not found" };
  if (rows[0].role === "admin") return { ok: false, error: "Cannot delete the dealer admin account" };

  await db.delete(schema.dealerUsers).where(eq(schema.dealerUsers.id, userId));
  await logAudit({
    action: "admin_dealer_team_member_deleted",
    summary: `Deleted exec team member ${userId} from tenant ${tenantId}`,
    entityType: "dealer_user",
    entityId: userId,
    payload: { tenantId },
  });
  return { ok: true };
}

// ── Expiry Alerts ─────────────────────────────────────────────────────────────

export async function checkExpiringTenants(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = addDays(today, 7);

  const tenants = await db
    .select({
      id: schema.dealerTenants.id,
      businessName: schema.dealerTenants.businessName,
      expiresAt: schema.dealerTenants.expiresAt,
    })
    .from(schema.dealerTenants)
    .where(
      sql`${schema.dealerTenants.status} = 'active'
        AND ${schema.dealerTenants.expiresAt} <= ${in7}
        AND ${schema.dealerTenants.expiresAt} >= ${today}
        AND ${schema.dealerTenants.id} != 'owner'`,
    );

  for (const t of tenants) {
    const entityId = `expiry_${t.id}_${t.expiresAt}`;
    const existing = await db
      .select({ id: schema.ownerAlerts.id })
      .from(schema.ownerAlerts)
      .where(
        sql`${schema.ownerAlerts.entityId} = ${entityId} AND ${schema.ownerAlerts.isRead} = false`,
      )
      .limit(1);

    if (existing.length > 0) continue;

    const daysLeft = Math.ceil(
      (new Date(t.expiresAt).getTime() - new Date(today).getTime()) / 86400000,
    );
    await db.insert(schema.ownerAlerts).values({
      id: randomUUID(),
      tenantId: "owner",
      type: "tenant_expiry_warning",
      entityType: "dealer_tenant",
      entityId,
      dealerId: null,
      message: `${t.businessName} — subscription expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} (${t.expiresAt})`,
      isRead: false,
      payload: JSON.stringify({ tenantId: t.id, expiresAt: t.expiresAt, daysLeft }),
    });
  }
}

// ── Billing ───────────────────────────────────────────────────────────────────

export interface BillingEventRow {
  id: string;
  amount: number;
  paidAt: string;
  note: string | null;
  recordedBy: string | null;
  monthsAdded: number | null;
  createdAt: string;
}

export async function getBillingEvents(tenantId: string): Promise<BillingEventRow[]> {
  const rows = await db
    .select({
      id: schema.billingEvents.id,
      amount: schema.billingEvents.amount,
      paidAt: schema.billingEvents.paidAt,
      note: schema.billingEvents.note,
      recordedBy: schema.billingEvents.recordedBy,
      monthsAdded: schema.billingEvents.monthsAdded,
      createdAt: schema.billingEvents.createdAt,
    })
    .from(schema.billingEvents)
    .where(eq(schema.billingEvents.tenantId, tenantId))
    .orderBy(desc(schema.billingEvents.createdAt));
  return rows.map((r) => ({ ...r, createdAt: String(r.createdAt) }));
}

export async function recordBillingPayment(
  tenantId: string,
  amount: number,
  paidAt: string,
  note: string | null,
  recordedBy: string,
  monthsAdded: number | null,
): Promise<void> {
  await db.insert(schema.billingEvents).values({
    id: randomUUID(),
    tenantId,
    amount,
    paidAt,
    note,
    recordedBy,
    monthsAdded,
    createdAt: new Date().toISOString(),
  });

  if (monthsAdded && monthsAdded > 0) {
    await renewTenant(tenantId, monthsAdded);
  }

  await logAudit({
    action: "admin_billing_payment_recorded",
    summary: `Recorded PKR ${amount} payment for tenant ${tenantId}`,
    entityType: "dealer_tenant",
    entityId: tenantId,
    payload: { amount, paidAt, note, monthsAdded },
  });
}

export async function suspendTenant(tenantId: string): Promise<void> {
  await db
    .update(schema.dealerTenants)
    .set({ status: "suspended" })
    .where(eq(schema.dealerTenants.id, tenantId));

  await logAudit({
    action: "admin_tenant_suspended",
    summary: `Suspended tenant ${tenantId}`,
    entityType: "dealer_tenant",
    entityId: tenantId,
  });
}

export async function reactivateTenant(tenantId: string): Promise<void> {
  await db
    .update(schema.dealerTenants)
    .set({ status: "active" })
    .where(eq(schema.dealerTenants.id, tenantId));

  await logAudit({
    action: "admin_tenant_reactivated",
    summary: `Reactivated tenant ${tenantId}`,
    entityType: "dealer_tenant",
    entityId: tenantId,
  });
}

export async function updateMonthlyFee(tenantId: string, monthlyFee: number): Promise<void> {
  await db
    .update(schema.dealerTenants)
    .set({ monthlyFee })
    .where(eq(schema.dealerTenants.id, tenantId));

  await logAudit({
    action: "admin_tenant_fee_updated",
    summary: `Updated monthly fee for tenant ${tenantId} to PKR ${monthlyFee}`,
    entityType: "dealer_tenant",
    entityId: tenantId,
    payload: { monthlyFee },
  });
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

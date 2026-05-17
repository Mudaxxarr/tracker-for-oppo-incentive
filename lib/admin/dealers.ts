import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, schema } from "@/lib/db/client";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

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
  createdAt: string;
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

  return { ...tenant, users: userRows };
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

export async function getRevenueSummary() {
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = addDays(today, 30);

  const rows = await db
    .select({
      status: schema.dealerTenants.status,
      expiresAt: schema.dealerTenants.expiresAt,
    })
    .from(schema.dealerTenants)
    .where(sql`${schema.dealerTenants.id} != 'owner'`);

  let active = 0, expiringSoon = 0, grace = 0, expired = 0, suspended = 0;

  for (const row of rows) {
    if (row.status === "suspended") { suspended++; continue; }
    if (row.status === "grace") { grace++; continue; }
    if (row.status === "expired") { expired++; continue; }
    active++;
    if (row.expiresAt <= in30Days) expiringSoon++;
  }

  return { total: rows.length, active, expiringSoon, grace, expired, suspended };
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => chars[b % chars.length]).join("");
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

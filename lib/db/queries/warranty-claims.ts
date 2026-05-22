import "server-only";
import { db, schema } from "../client";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export interface WarrantyClaimRow {
  id: string;
  tenantId: string;
  dealerId: string;
  dealerName: string;
  customerId: string | null;
  customerName: string | null;
  activationId: string | null;
  modelId: string;
  modelName: string;
  issueDesc: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

export async function createWarrantyClaim(input: {
  tenantId: string;
  dealerId: string;
  customerId?: string | null;
  activationId?: string | null;
  modelId: string;
  issueDesc: string;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.warrantyClaims).values({
    id,
    tenantId: input.tenantId,
    dealerId: input.dealerId,
    customerId: input.customerId ?? null,
    activationId: input.activationId ?? null,
    modelId: input.modelId,
    issueDesc: input.issueDesc.trim(),
    status: "pending",
  });
  return id;
}

export async function getWarrantyClaimById(id: string, tenantId: string): Promise<WarrantyClaimRow | null> {
  const rows = await db
    .select({
      id: schema.warrantyClaims.id,
      tenantId: schema.warrantyClaims.tenantId,
      dealerId: schema.warrantyClaims.dealerId,
      dealerName: schema.dealerIds.name,
      customerId: schema.warrantyClaims.customerId,
      customerName: schema.customers.name,
      activationId: schema.warrantyClaims.activationId,
      modelId: schema.warrantyClaims.modelId,
      modelName: schema.models.name,
      issueDesc: schema.warrantyClaims.issueDesc,
      status: schema.warrantyClaims.status,
      createdAt: schema.warrantyClaims.createdAt,
      resolvedAt: schema.warrantyClaims.resolvedAt,
    })
    .from(schema.warrantyClaims)
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.warrantyClaims.dealerId))
    .innerJoin(schema.models, eq(schema.models.id, schema.warrantyClaims.modelId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.warrantyClaims.customerId))
    .where(and(eq(schema.warrantyClaims.id, id), eq(schema.warrantyClaims.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listWarrantyClaimsForDealer(tenantId: string, dealerId: string): Promise<WarrantyClaimRow[]> {
  return db
    .select({
      id: schema.warrantyClaims.id,
      tenantId: schema.warrantyClaims.tenantId,
      dealerId: schema.warrantyClaims.dealerId,
      dealerName: schema.dealerIds.name,
      customerId: schema.warrantyClaims.customerId,
      customerName: schema.customers.name,
      activationId: schema.warrantyClaims.activationId,
      modelId: schema.warrantyClaims.modelId,
      modelName: schema.models.name,
      issueDesc: schema.warrantyClaims.issueDesc,
      status: schema.warrantyClaims.status,
      createdAt: schema.warrantyClaims.createdAt,
      resolvedAt: schema.warrantyClaims.resolvedAt,
    })
    .from(schema.warrantyClaims)
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.warrantyClaims.dealerId))
    .innerJoin(schema.models, eq(schema.models.id, schema.warrantyClaims.modelId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.warrantyClaims.customerId))
    .where(and(eq(schema.warrantyClaims.tenantId, tenantId), eq(schema.warrantyClaims.dealerId, dealerId)))
    .orderBy(desc(schema.warrantyClaims.createdAt));
}

export async function listAllWarrantyClaims(tenantId: string): Promise<WarrantyClaimRow[]> {
  return db
    .select({
      id: schema.warrantyClaims.id,
      tenantId: schema.warrantyClaims.tenantId,
      dealerId: schema.warrantyClaims.dealerId,
      dealerName: schema.dealerIds.name,
      customerId: schema.warrantyClaims.customerId,
      customerName: schema.customers.name,
      activationId: schema.warrantyClaims.activationId,
      modelId: schema.warrantyClaims.modelId,
      modelName: schema.models.name,
      issueDesc: schema.warrantyClaims.issueDesc,
      status: schema.warrantyClaims.status,
      createdAt: schema.warrantyClaims.createdAt,
      resolvedAt: schema.warrantyClaims.resolvedAt,
    })
    .from(schema.warrantyClaims)
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.warrantyClaims.dealerId))
    .innerJoin(schema.models, eq(schema.models.id, schema.warrantyClaims.modelId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.warrantyClaims.customerId))
    .where(eq(schema.warrantyClaims.tenantId, tenantId))
    .orderBy(desc(schema.warrantyClaims.createdAt));
}

export async function updateWarrantyClaimStatus(
  id: string,
  status: string,
  tenantId: string
): Promise<void> {
  const resolvedAt = (status === "resolved" || status === "rejected") ? new Date().toISOString() : null;
  await db
    .update(schema.warrantyClaims)
    .set({ status, ...(resolvedAt !== undefined ? { resolvedAt } : {}) })
    .where(and(eq(schema.warrantyClaims.id, id), eq(schema.warrantyClaims.tenantId, tenantId)));
}

export async function countWarrantyClaimsByStatus(tenantId: string, dealerId?: string) {
  const conds = dealerId
    ? and(eq(schema.warrantyClaims.tenantId, tenantId), eq(schema.warrantyClaims.dealerId, dealerId))
    : eq(schema.warrantyClaims.tenantId, tenantId);
  const rows = await db
    .select({ status: schema.warrantyClaims.status, count: sql<number>`count(*)::int` })
    .from(schema.warrantyClaims)
    .where(conds)
    .groupBy(schema.warrantyClaims.status);
  return rows;
}

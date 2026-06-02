import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, gte, lte, ne } from "drizzle-orm";
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

/**
 * Returns an existing stock-in policy for the same model whose date window overlaps
 * [periodStart, periodEnd], or null. Two ranges overlap iff existingStart <= newEnd
 * AND existingEnd >= newStart. `excludeId` skips the row being edited.
 */
export async function findOverlappingStockInPolicy(
  tenantId: string, dealerId: string, modelId: string,
  periodStart: string, periodEnd: string, excludeId?: string
): Promise<{ id: string; periodStart: string; periodEnd: string } | null> {
  const rows = await db
    .select({ id: schema.stockInPolicies.id, periodStart: schema.stockInPolicies.periodStart, periodEnd: schema.stockInPolicies.periodEnd })
    .from(schema.stockInPolicies)
    .where(and(
      eq(schema.stockInPolicies.tenantId, tenantId),
      eq(schema.stockInPolicies.dealerId, dealerId),
      eq(schema.stockInPolicies.modelId, modelId),
      lte(schema.stockInPolicies.periodStart, periodEnd),
      gte(schema.stockInPolicies.periodEnd, periodStart),
      ...(excludeId ? [ne(schema.stockInPolicies.id, excludeId)] : []),
    ))
    .limit(1);
  return rows[0] ?? null;
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

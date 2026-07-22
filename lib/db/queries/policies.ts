import "server-only";
import { revalidateTag } from "next/cache";
import { db, schema } from "../client";
import { and, asc, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";

// ===== Target Bonus =====

export async function listTargetBonusPolicies(tenantId: string, dealerId: string) {
  return db.select().from(schema.targetBonusPolicies)
    .where(and(eq(schema.targetBonusPolicies.tenantId, tenantId), eq(schema.targetBonusPolicies.dealerId, dealerId)))
    .orderBy(desc(schema.targetBonusPolicies.periodStart));
}

export async function createTargetBonusPolicy(input: {
  tenantId: string; dealerId: string; periodStart: string; periodEnd: string;
  targetActivationsQty: number; bonusPercent: number; bonusCapQty?: number | null;
}) {
  const id = randomUUID();
  await db.insert(schema.targetBonusPolicies).values({ id, ...input });
  revalidateTag("dealer-policies", {});
  return id;
}

export async function updateTargetBonusPolicy(id: string, tenantId: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; targetActivationsQty: number; bonusPercent: number; bonusCapQty?: number | null;
}) {
  await db.update(schema.targetBonusPolicies).set(input)
    .where(and(eq(schema.targetBonusPolicies.id, id), eq(schema.targetBonusPolicies.tenantId, tenantId), eq(schema.targetBonusPolicies.dealerId, dealerId)));
  revalidateTag("dealer-policies", {});
}

export async function deleteTargetBonusPolicy(id: string, tenantId: string, dealerId: string) {
  await db.delete(schema.targetBonusPolicies)
    .where(and(eq(schema.targetBonusPolicies.id, id), eq(schema.targetBonusPolicies.tenantId, tenantId), eq(schema.targetBonusPolicies.dealerId, dealerId)));
  revalidateTag("dealer-policies", {});
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
  revalidateTag("dealer-policies", {});
  return id;
}

export async function updateStockInPolicy(id: string, tenantId: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; perUnitAmount: number; minQty: number | null;
}) {
  await db.update(schema.stockInPolicies).set(input)
    .where(and(eq(schema.stockInPolicies.id, id), eq(schema.stockInPolicies.tenantId, tenantId), eq(schema.stockInPolicies.dealerId, dealerId)));
  revalidateTag("dealer-policies", {});
}

export async function deleteStockInPolicy(id: string, tenantId: string, dealerId: string) {
  await db.delete(schema.stockInPolicies)
    .where(and(eq(schema.stockInPolicies.id, id), eq(schema.stockInPolicies.tenantId, tenantId), eq(schema.stockInPolicies.dealerId, dealerId)));
  revalidateTag("dealer-policies", {});
}

// ===== Combined Stock-In (grouped target, per-model rate) =====

export interface CombinedStockInPolicyRow {
  id: string; periodStart: string; periodEnd: string; targetQty: number;
  models: { modelId: string; modelName: string; perUnitAmount: number }[];
}

export async function listCombinedStockInPolicies(tenantId: string, dealerId: string): Promise<CombinedStockInPolicyRow[]> {
  const policies = await db.select().from(schema.combinedStockInPolicies)
    .where(and(eq(schema.combinedStockInPolicies.tenantId, tenantId), eq(schema.combinedStockInPolicies.dealerId, dealerId)))
    .orderBy(desc(schema.combinedStockInPolicies.periodStart));
  if (policies.length === 0) return [];
  const modelRows = await db
    .select({ policyId: schema.combinedStockInPolicyModels.policyId, modelId: schema.combinedStockInPolicyModels.modelId,
      modelName: schema.models.name, perUnitAmount: schema.combinedStockInPolicyModels.perUnitAmount })
    .from(schema.combinedStockInPolicyModels)
    .innerJoin(schema.models, eq(schema.models.id, schema.combinedStockInPolicyModels.modelId))
    .where(inArray(schema.combinedStockInPolicyModels.policyId, policies.map((p) => p.id)))
    .orderBy(asc(schema.models.name));
  const byPolicy = new Map<string, { modelId: string; modelName: string; perUnitAmount: number }[]>();
  for (const r of modelRows) {
    const list = byPolicy.get(r.policyId) ?? [];
    list.push({ modelId: r.modelId, modelName: r.modelName, perUnitAmount: r.perUnitAmount });
    byPolicy.set(r.policyId, list);
  }
  return policies.map((p) => ({
    id: p.id, periodStart: p.periodStart, periodEnd: p.periodEnd, targetQty: p.targetQty,
    models: byPolicy.get(p.id) ?? [],
  }));
}

/**
 * Safety guard: returns the name of the first of `modelIds` that already has a
 * stock-in policy — per-model OR combined — whose window overlaps
 * [periodStart, periodEnd], or null if none. Enforces the owner's invariant that
 * a model's stock-in policies never overlap in time, so no double-pay is possible.
 */
export async function findStockInOverlapForModels(
  tenantId: string, dealerId: string, modelIds: string[],
  periodStart: string, periodEnd: string, excludeCombinedId?: string,
): Promise<string | null> {
  if (modelIds.length === 0) return null;
  const perModel = await db
    .select({ modelName: schema.models.name })
    .from(schema.stockInPolicies)
    .innerJoin(schema.models, eq(schema.models.id, schema.stockInPolicies.modelId))
    .where(and(
      eq(schema.stockInPolicies.tenantId, tenantId), eq(schema.stockInPolicies.dealerId, dealerId),
      inArray(schema.stockInPolicies.modelId, modelIds),
      lte(schema.stockInPolicies.periodStart, periodEnd), gte(schema.stockInPolicies.periodEnd, periodStart),
    ))
    .limit(1);
  if (perModel[0]) return perModel[0].modelName;

  const combined = await db
    .select({ modelName: schema.models.name })
    .from(schema.combinedStockInPolicyModels)
    .innerJoin(schema.combinedStockInPolicies, eq(schema.combinedStockInPolicies.id, schema.combinedStockInPolicyModels.policyId))
    .innerJoin(schema.models, eq(schema.models.id, schema.combinedStockInPolicyModels.modelId))
    .where(and(
      eq(schema.combinedStockInPolicies.tenantId, tenantId), eq(schema.combinedStockInPolicies.dealerId, dealerId),
      inArray(schema.combinedStockInPolicyModels.modelId, modelIds),
      lte(schema.combinedStockInPolicies.periodStart, periodEnd), gte(schema.combinedStockInPolicies.periodEnd, periodStart),
      ...(excludeCombinedId ? [ne(schema.combinedStockInPolicies.id, excludeCombinedId)] : []),
    ))
    .limit(1);
  return combined[0]?.modelName ?? null;
}

export async function createCombinedStockInPolicy(input: {
  tenantId: string; dealerId: string; periodStart: string; periodEnd: string; targetQty: number;
  models: { modelId: string; perUnitAmount: number }[];
}): Promise<string> {
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.combinedStockInPolicies).values({
      id, tenantId: input.tenantId, dealerId: input.dealerId,
      periodStart: input.periodStart, periodEnd: input.periodEnd, targetQty: input.targetQty,
    });
    for (const m of input.models) {
      await tx.insert(schema.combinedStockInPolicyModels).values({
        id: randomUUID(), policyId: id, modelId: m.modelId, perUnitAmount: m.perUnitAmount,
      });
    }
  });
  revalidateTag("dealer-policies", {});
  return id;
}

export async function deleteCombinedStockInPolicy(id: string, tenantId: string, dealerId: string) {
  // policy-models rows cascade via FK.
  await db.delete(schema.combinedStockInPolicies)
    .where(and(eq(schema.combinedStockInPolicies.id, id), eq(schema.combinedStockInPolicies.tenantId, tenantId), eq(schema.combinedStockInPolicies.dealerId, dealerId)));
  revalidateTag("dealer-policies", {});
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
  revalidateTag("dealer-policies", {});
  return id;
}

export async function updateActivationIncentivePolicy(id: string, tenantId: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; perUnitAmount: number; targetQty: number | null;
}) {
  await db.update(schema.activationIncentivePolicies).set(input)
    .where(and(eq(schema.activationIncentivePolicies.id, id), eq(schema.activationIncentivePolicies.tenantId, tenantId), eq(schema.activationIncentivePolicies.dealerId, dealerId)));
  revalidateTag("dealer-policies", {});
}

export async function deleteActivationIncentivePolicy(id: string, tenantId: string, dealerId: string) {
  await db.delete(schema.activationIncentivePolicies)
    .where(and(eq(schema.activationIncentivePolicies.id, id), eq(schema.activationIncentivePolicies.tenantId, tenantId), eq(schema.activationIncentivePolicies.dealerId, dealerId)));
  revalidateTag("dealer-policies", {});
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
  revalidateTag("dealer-policies", {});
  return id;
}

export async function updateDealerIncentivePolicy(id: string, tenantId: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; targetTotalActivations: number; perUnitAmount: number;
}) {
  await db.update(schema.dealerIncentivePolicies).set(input)
    .where(and(eq(schema.dealerIncentivePolicies.id, id), eq(schema.dealerIncentivePolicies.tenantId, tenantId), eq(schema.dealerIncentivePolicies.dealerId, dealerId)));
  revalidateTag("dealer-policies", {});
}

export async function deleteDealerIncentivePolicy(id: string, tenantId: string, dealerId: string) {
  await db.delete(schema.dealerIncentivePolicies)
    .where(and(eq(schema.dealerIncentivePolicies.id, id), eq(schema.dealerIncentivePolicies.tenantId, tenantId), eq(schema.dealerIncentivePolicies.dealerId, dealerId)));
  revalidateTag("dealer-policies", {});
}

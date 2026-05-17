import "server-only";
import { db, schema } from "../client";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";

// ===== Target Bonus =====

export async function listTargetBonusPolicies(dealerId: string) {
  return db
    .select()
    .from(schema.targetBonusPolicies)
    .where(eq(schema.targetBonusPolicies.dealerId, dealerId))
    .orderBy(desc(schema.targetBonusPolicies.periodStart));
}

export async function createTargetBonusPolicy(input: {
  dealerId: string;
  periodStart: string;
  periodEnd: string;
  targetActivationsQty: number;
  bonusPercent: number;
}) {
  const id = randomUUID();
  await db.insert(schema.targetBonusPolicies).values({ id, ...input });
  return id;
}

export async function deleteTargetBonusPolicy(id: string, dealerId: string) {
  await db
    .delete(schema.targetBonusPolicies)
    .where(
      and(
        eq(schema.targetBonusPolicies.id, id),
        eq(schema.targetBonusPolicies.dealerId, dealerId)
      )
    );
}

// ===== Stock-In =====

export interface StockInPolicyRow {
  id: string;
  modelId: string;
  modelName: string;
  periodStart: string;
  periodEnd: string;
  perUnitAmount: number;
  minQty: number | null;
}

export async function listStockInPolicies(dealerId: string): Promise<StockInPolicyRow[]> {
  return db
    .select({
      id: schema.stockInPolicies.id,
      modelId: schema.stockInPolicies.modelId,
      modelName: schema.models.name,
      periodStart: schema.stockInPolicies.periodStart,
      periodEnd: schema.stockInPolicies.periodEnd,
      perUnitAmount: schema.stockInPolicies.perUnitAmount,
      minQty: schema.stockInPolicies.minQty,
    })
    .from(schema.stockInPolicies)
    .innerJoin(schema.models, eq(schema.models.id, schema.stockInPolicies.modelId))
    .where(eq(schema.stockInPolicies.dealerId, dealerId))
    .orderBy(desc(schema.stockInPolicies.periodStart), asc(schema.models.name));
}

export async function createStockInPolicy(input: {
  dealerId: string;
  modelId: string;
  periodStart: string;
  periodEnd: string;
  perUnitAmount: number;
  minQty: number | null;
}) {
  const id = randomUUID();
  await db.insert(schema.stockInPolicies).values({ id, ...input });
  return id;
}

export async function deleteStockInPolicy(id: string, dealerId: string) {
  await db
    .delete(schema.stockInPolicies)
    .where(
      and(eq(schema.stockInPolicies.id, id), eq(schema.stockInPolicies.dealerId, dealerId))
    );
}

// ===== Activation Incentive =====

export interface ActivationIncentivePolicyRow {
  id: string;
  modelId: string;
  modelName: string;
  periodStart: string;
  periodEnd: string;
  perUnitAmount: number;
  targetQty: number | null;
}

export async function listActivationIncentivePolicies(
  dealerId: string
): Promise<ActivationIncentivePolicyRow[]> {
  return db
    .select({
      id: schema.activationIncentivePolicies.id,
      modelId: schema.activationIncentivePolicies.modelId,
      modelName: schema.models.name,
      periodStart: schema.activationIncentivePolicies.periodStart,
      periodEnd: schema.activationIncentivePolicies.periodEnd,
      perUnitAmount: schema.activationIncentivePolicies.perUnitAmount,
      targetQty: schema.activationIncentivePolicies.targetQty,
    })
    .from(schema.activationIncentivePolicies)
    .innerJoin(
      schema.models,
      eq(schema.models.id, schema.activationIncentivePolicies.modelId)
    )
    .where(eq(schema.activationIncentivePolicies.dealerId, dealerId))
    .orderBy(
      desc(schema.activationIncentivePolicies.periodStart),
      asc(schema.models.name)
    );
}

export async function createActivationIncentivePolicy(input: {
  dealerId: string;
  modelId: string;
  periodStart: string;
  periodEnd: string;
  perUnitAmount: number;
  targetQty: number | null;
}) {
  const id = randomUUID();
  await db.insert(schema.activationIncentivePolicies).values({ id, ...input });
  return id;
}

export async function deleteActivationIncentivePolicy(id: string, dealerId: string) {
  await db
    .delete(schema.activationIncentivePolicies)
    .where(
      and(
        eq(schema.activationIncentivePolicies.id, id),
        eq(schema.activationIncentivePolicies.dealerId, dealerId)
      )
    );
}

// ===== Dealer Incentive =====

export interface DealerIncentivePolicyRow {
  id: string;
  modelId: string | null;
  modelName: string | null;
  periodStart: string;
  periodEnd: string;
  targetTotalActivations: number;
  perUnitAmount: number;
}

export async function listDealerIncentivePolicies(dealerId: string): Promise<DealerIncentivePolicyRow[]> {
  const rows = await db
    .select({
      id: schema.dealerIncentivePolicies.id,
      modelId: schema.dealerIncentivePolicies.modelId,
      modelName: schema.models.name,
      periodStart: schema.dealerIncentivePolicies.periodStart,
      periodEnd: schema.dealerIncentivePolicies.periodEnd,
      targetTotalActivations: schema.dealerIncentivePolicies.targetTotalActivations,
      perUnitAmount: schema.dealerIncentivePolicies.perUnitAmount,
    })
    .from(schema.dealerIncentivePolicies)
    .leftJoin(schema.models, eq(schema.models.id, schema.dealerIncentivePolicies.modelId))
    .where(eq(schema.dealerIncentivePolicies.dealerId, dealerId))
    .orderBy(desc(schema.dealerIncentivePolicies.periodStart), asc(schema.models.name));
  return rows;
}

export async function createDealerIncentivePolicy(input: {
  dealerId: string;
  modelId?: string | null;
  periodStart: string;
  periodEnd: string;
  targetTotalActivations: number;
  perUnitAmount: number;
}) {
  const id = randomUUID();
  await db.insert(schema.dealerIncentivePolicies).values({
    id,
    dealerId: input.dealerId,
    modelId: input.modelId ?? null,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    targetTotalActivations: input.targetTotalActivations,
    perUnitAmount: input.perUnitAmount,
  });
  return id;
}

// Suppress unused import warning
void or; void isNull;

// ===== Update functions =====

export async function updateTargetBonusPolicy(id: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; targetActivationsQty: number; bonusPercent: number;
}) {
  await db.update(schema.targetBonusPolicies)
    .set(input)
    .where(and(eq(schema.targetBonusPolicies.id, id), eq(schema.targetBonusPolicies.dealerId, dealerId)));
}

export async function updateStockInPolicy(id: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; perUnitAmount: number; minQty: number | null;
}) {
  await db.update(schema.stockInPolicies)
    .set(input)
    .where(and(eq(schema.stockInPolicies.id, id), eq(schema.stockInPolicies.dealerId, dealerId)));
}

export async function updateActivationIncentivePolicy(id: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; perUnitAmount: number; targetQty: number | null;
}) {
  await db.update(schema.activationIncentivePolicies)
    .set(input)
    .where(and(eq(schema.activationIncentivePolicies.id, id), eq(schema.activationIncentivePolicies.dealerId, dealerId)));
}

export async function updateDealerIncentivePolicy(id: string, dealerId: string, input: {
  periodStart: string; periodEnd: string; targetTotalActivations: number; perUnitAmount: number;
}) {
  await db.update(schema.dealerIncentivePolicies)
    .set(input)
    .where(and(eq(schema.dealerIncentivePolicies.id, id), eq(schema.dealerIncentivePolicies.dealerId, dealerId)));
}

export async function deleteDealerIncentivePolicy(id: string, dealerId: string) {
  await db
    .delete(schema.dealerIncentivePolicies)
    .where(
      and(
        eq(schema.dealerIncentivePolicies.id, id),
        eq(schema.dealerIncentivePolicies.dealerId, dealerId)
      )
    );
}

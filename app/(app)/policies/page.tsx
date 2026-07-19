import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import {
  listActivationIncentivePolicies,
  listCombinedStockInPolicies,
  listDealerIncentivePolicies,
  listStockInPolicies,
  listTargetBonusPolicies,
} from "@/lib/db/queries/policies";
import { db, schema } from "@/lib/db/client";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { PoliciesClient, type PolicyAchievements } from "./policies-client";

async function computeAchievements(
  tenantId: string,
  dealerId: string,
  tb: Awaited<ReturnType<typeof listTargetBonusPolicies>>,
  si: Awaited<ReturnType<typeof listStockInPolicies>>,
  ai: Awaited<ReturnType<typeof listActivationIncentivePolicies>>,
  di: Awaited<ReturnType<typeof listDealerIncentivePolicies>>,
  cs: Awaited<ReturnType<typeof listCombinedStockInPolicies>>
): Promise<PolicyAchievements> {
  // Fetch raw activations + purchases once, filter in JS per policy
  const [allActivations, allPurchases] = await Promise.all([
    db
      .select({
        modelId: schema.activations.modelId,
        activationDate: schema.activations.activationDate,
      })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId))),
    db
      .select({
        modelId: schema.purchases.modelId,
        purchaseDate: schema.purchases.purchaseDate,
        quantity: schema.purchases.quantity,
        source: schema.purchases.source,
      })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId))),
  ]);

  // Target bonus (1%) is gated on REGULAR purchase quantity only (not cross-region or inter-ID in).
  // Must match the engine's check exactly: source === "REGULAR".
  const targetBonus: Record<string, number> = {};
  for (const p of tb) {
    targetBonus[p.id] = allPurchases
      .filter(
        (r) =>
          r.source === "REGULAR" &&
          r.purchaseDate >= p.periodStart &&
          r.purchaseDate <= p.periodEnd
      )
      .reduce((s, r) => s + r.quantity, 0);
  }

  const stockIn: Record<string, number> = {};
  for (const p of si) {
    stockIn[p.id] = allPurchases
      .filter(
        (r) =>
          r.modelId === p.modelId &&
          r.purchaseDate >= p.periodStart &&
          r.purchaseDate <= p.periodEnd
      )
      .reduce((s, r) => s + r.quantity, 0);
  }

  const activationIncentive: Record<string, number> = {};
  for (const p of ai) {
    activationIncentive[p.id] = allActivations.filter(
      (a) =>
        a.modelId === p.modelId &&
        a.activationDate >= p.periodStart &&
        a.activationDate <= p.periodEnd
    ).length;
  }

  const dealerIncentive: Record<string, number> = {};
  for (const p of di) {
    // target is total activations across ALL models in the period
    dealerIncentive[p.id] = allActivations.filter(
      (a) => a.activationDate >= p.periodStart && a.activationDate <= p.periodEnd
    ).length;
  }

  // Combined stock-in: purchased qty across ALL models in the group (same rough
  // "purchased" indicator as per-model stock-in above; engine is precise on money).
  const combinedStockIn: Record<string, number> = {};
  for (const p of cs) {
    const modelIds = new Set(p.models.map((m) => m.modelId));
    combinedStockIn[p.id] = allPurchases
      .filter((r) => modelIds.has(r.modelId) && r.purchaseDate >= p.periodStart && r.purchaseDate <= p.periodEnd)
      .reduce((s, r) => s + r.quantity, 0);
  }

  return { targetBonus, stockIn, activationIncentive, dealerIncentive, combinedStockIn };
}

export default async function PoliciesPage() {
  const dealerId = await getActiveDealerId();
  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);

  if (!dealerId) {
    return (
      <PoliciesClient
        models={models}
        targetBonus={[]}
        stockIn={[]}
        combinedStockIn={[]}
        activationIncentive={[]}
        dealerIncentive={[]}
        achievements={{ targetBonus: {}, stockIn: {}, combinedStockIn: {}, activationIncentive: {}, dealerIncentive: {} }}
        hasDealer={false}
      />
    );
  }

  const [tb, si, ai, di, cs] = await Promise.all([
    listTargetBonusPolicies(OWNER_TENANT_ID, dealerId),
    listStockInPolicies(OWNER_TENANT_ID, dealerId),
    listActivationIncentivePolicies(OWNER_TENANT_ID, dealerId),
    listDealerIncentivePolicies(OWNER_TENANT_ID, dealerId),
    listCombinedStockInPolicies(OWNER_TENANT_ID, dealerId),
  ]);

  const achievements = await computeAchievements(OWNER_TENANT_ID, dealerId, tb, si, ai, di, cs);

  return (
    <PoliciesClient
      models={models}
      targetBonus={tb}
      stockIn={si}
      combinedStockIn={cs}
      activationIncentive={ai}
      dealerIncentive={di}
      achievements={achievements}
      hasDealer
    />
  );
}

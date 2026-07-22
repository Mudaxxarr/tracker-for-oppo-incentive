import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { isAuthenticated } from "@/lib/auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import {
  listTargetBonusPolicies,
  listStockInPolicies,
  listCombinedStockInPolicies,
  listActivationIncentivePolicies,
  listDealerIncentivePolicies,
} from "@/lib/db/queries/policies";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { db, schema } from "@/lib/db/client";
import { and, eq } from "drizzle-orm";
import { DealerPoliciesClient, type PolicyAchievements } from "./dealer-policies-client";

async function computeAchievements(
  tenantId: string,
  dealerId: string,
  tb: Awaited<ReturnType<typeof listTargetBonusPolicies>>,
  si: Awaited<ReturnType<typeof listStockInPolicies>>,
  ai: Awaited<ReturnType<typeof listActivationIncentivePolicies>>,
  di: Awaited<ReturnType<typeof listDealerIncentivePolicies>>,
  cs: Awaited<ReturnType<typeof listCombinedStockInPolicies>>
): Promise<PolicyAchievements> {
  const [allActivations, allPurchases] = await Promise.all([
    db
      .select({ modelId: schema.activations.modelId, activationDate: schema.activations.activationDate })
      .from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId))),
    db
      .select({ modelId: schema.purchases.modelId, purchaseDate: schema.purchases.purchaseDate, quantity: schema.purchases.quantity, source: schema.purchases.source })
      .from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId))),
  ]);

  const targetBonus: Record<string, number> = {};
  for (const p of tb) {
    targetBonus[p.id] = allPurchases
      .filter((r) => r.source === "REGULAR" && r.purchaseDate >= p.periodStart && r.purchaseDate <= p.periodEnd)
      .reduce((s, r) => s + r.quantity, 0);
  }

  const stockIn: Record<string, number> = {};
  for (const p of si) {
    stockIn[p.id] = allPurchases
      .filter((r) => r.modelId === p.modelId && r.purchaseDate >= p.periodStart && r.purchaseDate <= p.periodEnd)
      .reduce((s, r) => s + r.quantity, 0);
  }

  const activationIncentive: Record<string, number> = {};
  for (const p of ai) {
    activationIncentive[p.id] = allActivations.filter(
      (a) => a.modelId === p.modelId && a.activationDate >= p.periodStart && a.activationDate <= p.periodEnd
    ).length;
  }

  const dealerIncentive: Record<string, number> = {};
  for (const p of di) {
    dealerIncentive[p.id] = allActivations.filter(
      (a) => (p.modelId == null || a.modelId === p.modelId) && a.activationDate >= p.periodStart && a.activationDate <= p.periodEnd
    ).length;
  }

  const combinedStockIn: Record<string, number> = {};
  for (const p of cs) {
    const modelIds = new Set(p.models.map((m) => m.modelId));
    combinedStockIn[p.id] = allPurchases
      .filter((r) => modelIds.has(r.modelId) && r.purchaseDate >= p.periodStart && r.purchaseDate <= p.periodEnd)
      .reduce((s, r) => s + r.quantity, 0);
  }

  return { targetBonus, stockIn, activationIncentive, dealerIncentive, combinedStockIn };
}

export default async function DealerPoliciesPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  if (session.role === "exec") redirect("/dealer/dashboard");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "policies")) return <FeatureDisabled />;

  const [dealerId, models] = await Promise.all([
    getActiveDealerIdForTenant(session.tenantId),
    listModelsWithCurrentPrice(OWNER_TENANT_ID),
  ]);

  if (!dealerId) {
    return (
      <DealerPoliciesClient
        models={models}
        targetBonus={[]}
        stockIn={[]}
        combinedStockIn={[]}
        activationIncentive={[]}
        dealerIncentive={[]}
        achievements={{ targetBonus: {}, stockIn: {}, combinedStockIn: {}, activationIncentive: {}, dealerIncentive: {} }}
        hasDealer={false}
        canGrantRelief={false}
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

  // Use session.tenantId (dealer's own data) for achievement counting
  const achievements = await computeAchievements(session.tenantId, dealerId, tb, si, ai, di, cs);

  return (
    <DealerPoliciesClient
      models={models}
      targetBonus={tb}
      stockIn={si}
      combinedStockIn={cs}
      activationIncentive={ai}
      dealerIncentive={di}
      achievements={achievements}
      hasDealer
      canGrantRelief={await isAuthenticated()}
    />
  );
}

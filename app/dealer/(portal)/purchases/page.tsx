import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { isFeatureKeyOn } from "@/lib/feature-registry";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { listPurchases } from "@/lib/db/queries/purchases";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { DealerPurchasesClient } from "./dealer-purchases-client";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { getTenantById } from "@/lib/dealer-tenant";

interface SearchParams {
  modelId?: string;
  source?: string;
  from?: string;
  to?: string;
}

export default async function DealerPurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "purchases")) return <FeatureDisabled />;

  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  const sp = await searchParams;

  const [models, purchases, tenant] = await Promise.all([
    listModelsWithCurrentPrice(OWNER_TENANT_ID),
    dealerId
      ? listPurchases({
          tenantId: session.tenantId,
          dealerId,
          modelId: sp.modelId || undefined,
          source: (sp.source as typeof PURCHASE_SOURCE[keyof typeof PURCHASE_SOURCE] | undefined) || undefined,
          from: sp.from || undefined,
          to: sp.to || undefined,
        })
      : Promise.resolve([]),
    getTenantById(session.tenantId),
  ]);
  const backdateDays = tenant?.backdateDays ?? 3;

  return (
    <DealerPurchasesClient
      models={models}
      initialPurchases={purchases}
      initialFilters={sp}
      hasDealer={!!dealerId}
      dealerId={dealerId}
      tenantId={session.tenantId}
      role={session.role as "admin" | "exec"}
      backdateDays={backdateDays}
      canBulk={isFeatureKeyOn(features, "pur_bulk")}
    />
  );
}

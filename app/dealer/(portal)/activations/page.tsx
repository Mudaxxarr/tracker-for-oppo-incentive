import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { listActivations } from "@/lib/db/queries/activations";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { DealerActivationsClient } from "./dealer-activations-client";
import { OWNER_TENANT_ID } from "@/lib/dealer";

interface SearchParams {
  modelId?: string;
  from?: string;
  to?: string;
}

export default async function DealerActivationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "activations")) return <FeatureDisabled />;

  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  const sp = await searchParams;

  const [models, activations, stock] = await Promise.all([
    listModelsWithCurrentPrice(OWNER_TENANT_ID),
    dealerId
      ? listActivations({
          tenantId: session.tenantId,
          dealerId,
          modelId: sp.modelId || undefined,
          from: sp.from || undefined,
          to: sp.to || undefined,
        })
      : Promise.resolve([]),
    dealerId
      ? listStockForDealer(session.tenantId, dealerId, OWNER_TENANT_ID)
      : Promise.resolve([]),
  ]);

  return (
    <DealerActivationsClient
      models={models}
      stock={stock}
      initialActivations={activations}
      initialFilters={sp}
      hasDealer={!!dealerId}
      dealerId={dealerId}
      tenantId={session.tenantId}
      role={session.role as "admin" | "exec"}
    />
  );
}

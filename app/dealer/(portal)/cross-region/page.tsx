import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { listCrossRegion } from "@/lib/db/queries/transfers";
import { listCrCaught } from "@/lib/db/queries/cr-caught";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { DealerCrossRegionClient } from "./dealer-cross-region-client";
import { OWNER_TENANT_ID } from "@/lib/dealer";

export default async function DealerCrossRegionPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "cross_region")) return <FeatureDisabled />;

  const dealerId = await getActiveDealerIdForTenant(session.tenantId);

  const [models, transfers, crCaughtRows] = await Promise.all([
    listModelsWithCurrentPrice(OWNER_TENANT_ID),
    dealerId ? listCrossRegion(session.tenantId, dealerId) : Promise.resolve([]),
    dealerId ? listCrCaught(session.tenantId, dealerId) : Promise.resolve([]),
  ]);

  return (
    <DealerCrossRegionClient
      models={models}
      initialTransfers={transfers}
      initialCrCaughtRows={crCaughtRows}
      hasDealer={!!dealerId}
    />
  );
}

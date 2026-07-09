import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { isFeatureKeyOn } from "@/lib/feature-registry";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { listActivations, getActivationOverviewStats } from "@/lib/db/queries/activations";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { getConstants } from "@/lib/settings";
import { DealerActivationsClient } from "./dealer-activations-client";
import { OWNER_TENANT_ID } from "@/lib/dealer";

interface SearchParams {
  modelId?: string;
  from?: string;
  to?: string;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { from, to };
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

  const defaultRange = currentMonthRange();
  const overviewFrom = sp.from || defaultRange.from;
  const overviewTo = sp.to || defaultRange.to;

  const [models, activations, stock, overview, constants] = await Promise.all([
    listModelsWithCurrentPrice(OWNER_TENANT_ID),
    dealerId
      ? listActivations({ tenantId: session.tenantId, dealerId, modelId: sp.modelId || undefined, from: sp.from || undefined, to: sp.to || undefined })
      : Promise.resolve([]),
    dealerId ? listStockForDealer(session.tenantId, dealerId, OWNER_TENANT_ID) : Promise.resolve([]),
    dealerId
      ? getActivationOverviewStats({ tenantId: session.tenantId, dealerId, modelId: sp.modelId || undefined, from: overviewFrom, to: overviewTo })
      : Promise.resolve(null),
    getConstants(),
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
      canBulk={isFeatureKeyOn(features, "act_bulk")}
      canBulkDelete={isFeatureKeyOn(features, "act_bulk_delete")}
      canOverview={isFeatureKeyOn(features, "act_overview")}
      overview={overview}
      overviewRange={{ from: overviewFrom, to: overviewTo }}
      basePercent={constants.basePercent}
    />
  );
}

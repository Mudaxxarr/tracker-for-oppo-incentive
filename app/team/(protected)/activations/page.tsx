import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listActivations, getActivationOverviewStats } from "@/lib/db/queries/activations";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { getConstants } from "@/lib/settings";
import { ActivationsClient } from "@/app/(app)/activations/activations-client";

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

export default async function TeamActivationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const dealerId = await getActiveDealerId();
  const sp = await searchParams;
  const allModels = await listModelsWithCurrentPrice(OWNER_TENANT_ID);

  const defaultRange = currentMonthRange();
  const overviewFrom = sp.from || defaultRange.from;
  const overviewTo = sp.to || defaultRange.to;

  const [stock, activations, overview, constants] = await Promise.all([
    dealerId ? listStockForDealer(OWNER_TENANT_ID, dealerId) : Promise.resolve([]),
    dealerId
      ? listActivations({ tenantId: OWNER_TENANT_ID, dealerId, modelId: sp.modelId || undefined, from: sp.from || undefined, to: sp.to || undefined })
      : Promise.resolve([]),
    dealerId
      ? getActivationOverviewStats({ tenantId: OWNER_TENANT_ID, dealerId, modelId: sp.modelId || undefined, from: overviewFrom, to: overviewTo })
      : Promise.resolve(null),
    getConstants(),
  ]);

  return (
    <ActivationsClient
      models={allModels}
      stock={stock}
      initialActivations={activations}
      initialFilters={sp}
      hasDealer={!!dealerId}
      dealerId={dealerId}
      tenantId={OWNER_TENANT_ID}
      overview={overview}
      overviewRange={{ from: overviewFrom, to: overviewTo }}
      basePercent={constants.basePercent}
    />
  );
}

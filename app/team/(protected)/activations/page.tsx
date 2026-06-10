import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listActivations } from "@/lib/db/queries/activations";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { ActivationsClient } from "@/app/(app)/activations/activations-client";

interface SearchParams {
  modelId?: string;
  from?: string;
  to?: string;
}

export default async function TeamActivationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const dealerId = await getActiveDealerId();
  const sp = await searchParams;
  const allModels = await listModelsWithCurrentPrice(OWNER_TENANT_ID);
  const stock = dealerId ? await listStockForDealer(OWNER_TENANT_ID, dealerId) : [];
  const activations = dealerId
    ? await listActivations({
        tenantId: OWNER_TENANT_ID,
        dealerId,
        modelId: sp.modelId || undefined,
        from: sp.from || undefined,
        to: sp.to || undefined,
      })
    : [];
  return (
    <ActivationsClient
      models={allModels}
      stock={stock}
      initialActivations={activations}
      initialFilters={sp}
      hasDealer={!!dealerId}
      dealerId={dealerId}
      tenantId={OWNER_TENANT_ID}
    />
  );
}

import { getActiveDealerId } from "@/lib/dealer";
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
  const allModels = await listModelsWithCurrentPrice();
  const stock = dealerId ? await listStockForDealer(dealerId) : [];
  const activations = dealerId
    ? await listActivations({
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
    />
  );
}

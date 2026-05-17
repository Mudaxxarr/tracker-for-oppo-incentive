import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listPurchases } from "@/lib/db/queries/purchases";
import { PurchasesClient } from "./purchases-client";

interface SearchParams {
  modelId?: string;
  source?: string;
  from?: string;
  to?: string;
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const dealerId = await getActiveDealerId();
  const sp = await searchParams;
  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);
  const purchases = dealerId
    ? await listPurchases({
        tenantId: OWNER_TENANT_ID,
        dealerId,
        modelId: sp.modelId || undefined,
        source: (sp.source as "REGULAR" | "CROSS_REGION_TRANSFER_IN" | undefined) || undefined,
        from: sp.from || undefined,
        to: sp.to || undefined,
      })
    : [];
  return (
    <PurchasesClient
      models={models}
      initialPurchases={purchases}
      initialFilters={sp}
      hasDealer={!!dealerId}
    />
  );
}

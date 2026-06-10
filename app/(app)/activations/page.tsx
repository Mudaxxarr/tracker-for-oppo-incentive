import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listActivations } from "@/lib/db/queries/activations";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { getStaffSession } from "@/lib/staff-auth";
import { ActivationsClient } from "./activations-client";

interface SearchParams {
  modelId?: string;
  from?: string;
  to?: string;
}

export default async function ActivationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [dealerId, staffSession, sp] = await Promise.all([
    getActiveDealerId(),
    getStaffSession(),
    searchParams,
  ]);
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
      staffRole={staffSession?.role ?? null}
    />
  );
}

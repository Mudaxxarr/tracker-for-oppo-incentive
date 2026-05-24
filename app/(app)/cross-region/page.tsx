import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listCrossRegion } from "@/lib/db/queries/transfers";
import { getStaffSession } from "@/lib/staff-auth";
import { CrossRegionClient } from "./cross-region-client";

export default async function CrossRegionPage() {
  const [dealerId, staffSession] = await Promise.all([getActiveDealerId(), getStaffSession()]);
  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);
  const transfers = dealerId ? await listCrossRegion(OWNER_TENANT_ID, dealerId) : [];
  return (
    <CrossRegionClient
      models={models}
      initial={transfers}
      hasDealer={!!dealerId}
      staffRole={staffSession?.role ?? null}
    />
  );
}

import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listCrossRegion } from "@/lib/db/queries/transfers";
import { listCrCaught } from "@/lib/db/queries/cr-caught";
import { getStaffSession } from "@/lib/staff-auth";
import { CrossRegionClient } from "./cross-region-client";

export default async function CrossRegionPage() {
  const [dealerId, staffSession] = await Promise.all([getActiveDealerId(), getStaffSession()]);
  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);
  const [transfers, crCaughtRows] = dealerId
    ? await Promise.all([
        listCrossRegion(OWNER_TENANT_ID, dealerId),
        listCrCaught(OWNER_TENANT_ID, dealerId),
      ])
    : [[], []];
  return (
    <CrossRegionClient
      models={models}
      initial={transfers}
      hasDealer={!!dealerId}
      staffRole={staffSession?.role ?? null}
      initialCrCaughtRows={crCaughtRows}
    />
  );
}

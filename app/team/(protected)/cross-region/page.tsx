import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listCrossRegion } from "@/lib/db/queries/transfers";
import { listCrCaught } from "@/lib/db/queries/cr-caught";
import { CrossRegionClient } from "@/app/(app)/cross-region/cross-region-client";

export default async function TeamCrossRegionPage() {
  const dealerId = await getActiveDealerId();
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
      initialCrCaughtRows={crCaughtRows}
    />
  );
}

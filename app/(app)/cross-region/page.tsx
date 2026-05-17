import { getActiveDealerId } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listCrossRegion } from "@/lib/db/queries/transfers";
import { CrossRegionClient } from "./cross-region-client";

export default async function CrossRegionPage() {
  const dealerId = await getActiveDealerId();
  const models = await listModelsWithCurrentPrice();
  const transfers = dealerId ? await listCrossRegion(dealerId) : [];
  return (
    <CrossRegionClient
      models={models}
      initial={transfers}
      hasDealer={!!dealerId}
    />
  );
}

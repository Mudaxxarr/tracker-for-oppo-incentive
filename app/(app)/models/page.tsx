import { listModelsWithCurrentPrice, listPriceHistory } from "@/lib/db/queries/models";
import { listRebatesForModel } from "@/lib/db/queries/rebates";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { ModelsClient } from "./models-client";
import type { ModelPriceHistory } from "@/lib/db/schema";
import type { RebateRow } from "@/lib/db/queries/rebates";

export default async function ModelsPage() {
  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);
  const [historyPairs, rebatePairs] = await Promise.all([
    Promise.all(models.map(async (m) => [m.id, await listPriceHistory(OWNER_TENANT_ID, m.id)] as const)),
    Promise.all(models.map(async (m) => [m.id, await listRebatesForModel(OWNER_TENANT_ID, m.id)] as const)),
  ]);
  const history: Record<string, ModelPriceHistory[]> = Object.fromEntries(historyPairs);
  const rebates: Record<string, RebateRow[]> = Object.fromEntries(rebatePairs);
  return <ModelsClient models={models} history={history} rebates={rebates} />;
}

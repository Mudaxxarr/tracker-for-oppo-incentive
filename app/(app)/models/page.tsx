import { listModelsWithCurrentPrice, listPriceHistory } from "@/lib/db/queries/models";
import { ModelsClient } from "./models-client";
import type { ModelPriceHistory } from "@/lib/db/schema";

export default async function ModelsPage() {
  const models = await listModelsWithCurrentPrice();
  const historyPairs = await Promise.all(
    models.map(async (m) => {
      const rows = await listPriceHistory(m.id);
      return [m.id, rows] as const;
    })
  );
  const history: Record<string, ModelPriceHistory[]> = Object.fromEntries(historyPairs);
  return <ModelsClient models={models} history={history} />;
}

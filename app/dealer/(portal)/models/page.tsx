import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { listModelsWithCurrentPrice, listPriceHistory } from "@/lib/db/queries/models";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { DealerModelsClient } from "./dealer-models-client";
import type { ModelPriceHistory } from "@/lib/db/schema";

export default async function DealerModelsPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "models")) return <FeatureDisabled />;

  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);
  const historyPairs = await Promise.all(
    models.map(async (m) => {
      const rows = await listPriceHistory(OWNER_TENANT_ID, m.id);
      return [m.id, rows] as const;
    }),
  );
  const history: Record<string, ModelPriceHistory[]> = Object.fromEntries(historyPairs);

  return <DealerModelsClient models={models} history={history} />;
}

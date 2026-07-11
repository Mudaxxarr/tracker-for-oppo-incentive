import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { listModelsWithCurrentPrice, listPriceHistory } from "@/lib/db/queries/models";
import { listRebatesForModel } from "@/lib/db/queries/rebates";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { DealerModelsClient } from "./dealer-models-client";
import type { ModelPriceHistory } from "@/lib/db/schema";
import type { RebateRow } from "@/lib/db/queries/rebates";

export default async function DealerModelsPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  if (session.role === "exec") redirect("/dealer/dashboard");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "models")) return <FeatureDisabled />;

  // Models list with OWNER reference prices (master catalog)
  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);

  // Owner (central) price history + this dealer's own rebate ledger.
  // Prices are owner-configured and drive every dealer's financials, so the
  // authoritative timeline lives on OWNER_TENANT_ID; rebates stay per-dealer.
  const [historyPairs, rebatePairs] = await Promise.all([
    Promise.all(models.map(async (m) => [m.id, await listPriceHistory(OWNER_TENANT_ID, m.id)] as const)),
    Promise.all(models.map(async (m) => [m.id, await listRebatesForModel(session.tenantId, m.id)] as const)),
  ]);

  const history: Record<string, ModelPriceHistory[]> = Object.fromEntries(historyPairs);
  const rebates: Record<string, RebateRow[]> = Object.fromEntries(rebatePairs);

  return (
    <DealerModelsClient
      models={models}
      history={history}
      rebates={rebates}
    />
  );
}

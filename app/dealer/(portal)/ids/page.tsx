import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { listDealerIdsForTenant } from "@/lib/dealer-tenant";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { listInterIdTransfers } from "@/lib/db/queries/transfers";
import { getDealerIdStatsAction } from "./actions";
import { DealerIdsClient } from "./dealer-ids-client";
import { OWNER_TENANT_ID } from "@/lib/dealer";

export default async function DealerIdsPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "ids")) return <FeatureDisabled />;

  const { tenantId } = session;

  const dealers = await listDealerIdsForTenant(tenantId);
  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);

  const [stats, stockData, allTransfersNested] = await Promise.all([
    getDealerIdStatsAction(tenantId, dealers.map((d) => d.id)),
    Promise.all(dealers.map((d) => listStockForDealer(tenantId, d.id, OWNER_TENANT_ID))),
    Promise.all(dealers.map((d) => listInterIdTransfers(tenantId, d.id))),
  ]);

  const stockByDealer: Record<string, string[]> = {};
  dealers.forEach((d, i) => {
    stockByDealer[d.id] = stockData[i].map((s) => s.modelId);
  });

  const transferMap = new Map(allTransfersNested.flat().map((t) => [t.id, t]));
  const transfers = [...transferMap.values()].sort((a, b) =>
    a.transferDate < b.transferDate ? 1 : -1,
  );

  return (
    <DealerIdsClient
      dealers={dealers.map((d) => ({ id: d.id, name: d.name, shopName: d.shopName, note: d.note }))}
      models={models}
      stats={stats}
      transfers={transfers}
      stockByDealer={stockByDealer}
    />
  );
}

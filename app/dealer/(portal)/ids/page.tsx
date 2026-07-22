import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { isAuthenticated } from "@/lib/auth";
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
  if (session.role === "exec") redirect("/dealer/dashboard");

  const features = await getTenantFeaturesById(session.tenantId);
  const { tenantId } = session;
  // Owner viewing this dealer's portal in preview (owner session still present)
  // gets owner-only powers here — chiefly provisioning additional Dealer IDs.
  const isAdminPreview = await isAuthenticated();

  // The management page must show hidden IDs — otherwise one could never be un-hidden.
  const dealers = await listDealerIdsForTenant(tenantId, { includeHidden: true });
  // Auto-enable for dealers who own 2+ IDs even if the `ids` feature flag is off —
  // they need Inter-ID Transfer to move stock between their own IDs. The owner in
  // preview always reaches this page so they can add the second ID in the first place.
  if (!isFeatureEnabled(features, "ids") && dealers.length < 2 && !isAdminPreview) return <FeatureDisabled />;
  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);

  const [stats, stockData, allTransfersNested] = await Promise.all([
    getDealerIdStatsAction(dealers.map((d) => d.id)),
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
      dealers={dealers.map((d) => ({ id: d.id, name: d.name, shopName: d.shopName, note: d.note, basePercentOverride: d.basePercentOverride, isHidden: d.isHidden }))}
      models={models}
      stats={stats}
      transfers={transfers}
      stockByDealer={stockByDealer}
      isAdminPreview={isAdminPreview}
    />
  );
}

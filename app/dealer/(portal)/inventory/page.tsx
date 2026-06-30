import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { isFeatureKeyOn } from "@/lib/feature-registry";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { getActiveDealerIdForTenant, listDealerIdsForTenant } from "@/lib/dealer-tenant";
import { listInventoryForDealer } from "@/lib/db/queries/inventory";
import { listPendingInbound } from "@/lib/db/queries/transfers";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { DealerInventoryClient } from "./dealer-inventory-client";

export default async function DealerInventoryPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "inventory")) return <FeatureDisabled />;

  const dealerId = await getActiveDealerIdForTenant(session.tenantId);

  const [rows, pending, allDealers] = await Promise.all([
    dealerId
      ? listInventoryForDealer(session.tenantId, dealerId, OWNER_TENANT_ID)
      : Promise.resolve([]),
    dealerId
      ? listPendingInbound(session.tenantId, dealerId)
      : Promise.resolve([]),
    listDealerIdsForTenant(session.tenantId),
  ]);

  const otherDealers = allDealers
    .filter((d) => d.id !== dealerId)
    .map((d) => ({ id: d.id, name: d.name }));

  return (
    <DealerInventoryClient
      rows={rows}
      otherDealers={otherDealers}
      hasDealer={!!dealerId}
      pendingTransfers={pending}
      canReceipts={isFeatureKeyOn(features, "inv_receipts")}
    />
  );
}

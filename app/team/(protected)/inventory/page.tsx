import { getActiveDealerId, listDealerIds, OWNER_TENANT_ID } from "@/lib/dealer";
import { listInventoryForDealer } from "@/lib/db/queries/inventory";
import { listPendingInbound } from "@/lib/db/queries/transfers";
import { InventoryClient } from "@/app/(app)/inventory/inventory-client";

export default async function TeamInventoryPage() {
  const dealerId = await getActiveDealerId();
  const [rows, allDealers, pendingTransfers] = await Promise.all([
    dealerId ? listInventoryForDealer(OWNER_TENANT_ID, dealerId) : Promise.resolve([]),
    listDealerIds(),
    dealerId ? listPendingInbound(OWNER_TENANT_ID, dealerId) : Promise.resolve([]),
  ]);

  const otherDealers = allDealers
    .filter((d) => d.id !== dealerId)
    .map((d) => ({ id: d.id, name: d.name }));

  return (
    <InventoryClient
      rows={rows}
      otherDealers={otherDealers}
      hasDealer={!!dealerId}
      pendingTransfers={pendingTransfers}
    />
  );
}

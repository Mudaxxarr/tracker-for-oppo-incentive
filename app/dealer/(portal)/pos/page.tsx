import { getDealerSession } from "@/lib/dealer-auth";
import { redirect } from "next/navigation";
import { getActiveDealerIdForTenant, getTenantById } from "@/lib/dealer-tenant";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureKeyOn } from "@/lib/feature-registry";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { PosClient } from "./pos-client";

export const metadata = { title: "Sell — POS" };

export default async function PosPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);

  const [stock, features] = await Promise.all([
    dealerId
      ? listStockForDealer(session.tenantId, dealerId, OWNER_TENANT_ID)
      : Promise.resolve([]),
    getTenantFeaturesById(session.tenantId),
  ]);

  return <PosClient stock={stock} canReceipt={isFeatureKeyOn(features, "pos_receipt")} />;
}

import { getDealerSession } from "@/lib/dealer-auth";
import { redirect } from "next/navigation";
import { getActiveDealerIdForTenant, getTenantById } from "@/lib/dealer-tenant";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { PosClient } from "./pos-client";

export const metadata = { title: "Sell — POS" };

export default async function PosPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);

  const stock = dealerId
    ? await listStockForDealer(session.tenantId, dealerId, OWNER_TENANT_ID)
    : [];

  return <PosClient stock={stock} />;
}

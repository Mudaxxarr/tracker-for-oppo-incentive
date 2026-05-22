import { getDealerSession } from "@/lib/dealer-auth";
import { redirect } from "next/navigation";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { listWarrantyClaimsForDealer } from "@/lib/db/queries/warranty-claims";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { DealerWarrantyClient } from "./dealer-warranty-client";

export const metadata = { title: "Warranty Claims" };

export default async function DealerWarrantyPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);

  const [claims, models] = await Promise.all([
    dealerId ? listWarrantyClaimsForDealer(session.tenantId, dealerId) : [],
    listModelsWithCurrentPrice(session.tenantId),
  ]);

  return <DealerWarrantyClient initialClaims={claims} models={models} />;
}

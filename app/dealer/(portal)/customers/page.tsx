import { getDealerSession } from "@/lib/dealer-auth";
import { redirect } from "next/navigation";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { listCustomersForDealer } from "@/lib/db/queries/customers";
import { DealerCustomersClient } from "./dealer-customers-client";

export const metadata = { title: "Customers" };

export default async function DealerCustomersPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);

  const customers = dealerId
    ? await listCustomersForDealer(session.tenantId, dealerId)
    : [];

  return <DealerCustomersClient initial={customers} />;
}

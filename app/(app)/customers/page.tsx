import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { listCustomersForOwner } from "@/lib/db/queries/customers";
import { CustomersClient } from "./customers-client";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  if (!(await isAuthenticated())) redirect("/unlock");
  const dealerId = await getActiveDealerId();

  const customers = dealerId ? await listCustomersForOwner(OWNER_TENANT_ID) : [];

  return <CustomersClient initial={customers} />;
}

import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getStaffSession } from "@/lib/staff-auth";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { getDailyReconciliationRows } from "@/lib/db/queries/reconciliation";
import { ReconciliationClient } from "./reconciliation-client";

export default async function ReconciliationPage() {
  const [ownerAuth, staffSession] = await Promise.all([isAuthenticated(), getStaffSession()]);
  const isAccountant = staffSession?.role === "accountant";
  if (!ownerAuth && !isAccountant) redirect("/login");

  const dealerId = await getActiveDealerId();
  const today = new Date().toISOString().slice(0, 10);
  const rows = dealerId
    ? await getDailyReconciliationRows(OWNER_TENANT_ID, dealerId, today)
    : [];

  return (
    <ReconciliationClient
      initialRows={rows}
      initialDate={today}
      hasDealer={!!dealerId}
    />
  );
}

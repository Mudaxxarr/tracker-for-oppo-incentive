import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRevenueSummary, checkExpiringTenants } from "@/lib/admin/dealers";
import { RevenueClient } from "./revenue-client";

export const metadata = { title: "Revenue Dashboard" };

export default async function AdminRevenuePage() {
  if (!(await isAuthenticated())) redirect("/login");
  const s = await getRevenueSummary();
  checkExpiringTenants().catch((e) => console.error("checkExpiringTenants:", e));

  return (
    <RevenueClient
      tenants={s.tenants}
      stats={{
        totalActive: s.active,
        totalGrace: s.grace,
        totalExpired: s.expired,
        totalSuspended: s.suspended,
        expiringIn7: s.expiringIn7,
        expiringIn30: s.expiringSoon - s.expiringIn7,
        mrr: s.mrr,
        arr: s.arr,
        collectedThisMonth: s.collectedThisMonth,
      }}
    />
  );
}

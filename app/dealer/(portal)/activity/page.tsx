import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { listAuditLog } from "@/lib/audit";
import { DealerActivityClient } from "./dealer-activity-client";

interface SearchParams {
  action?: string;
  search?: string;
  from?: string;
  to?: string;
}

export default async function DealerActivityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "activity")) return <FeatureDisabled />;

  const sp = await searchParams;
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);

  const rows = dealerId
    ? await listAuditLog({
        dealerId,
        action: sp.action,
        search: sp.search,
        from: sp.from,
        to: sp.to,
        limit: 500,
      })
    : [];

  return (
    <DealerActivityClient
      rows={rows}
      initialFilters={sp}
      hasDealer={!!dealerId}
    />
  );
}

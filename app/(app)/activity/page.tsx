import { listAuditLog } from "@/lib/audit";
import { listDealerIds } from "@/lib/dealer";
import { ActivityClient } from "./activity-client";

interface SearchParams {
  dealerId?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const [dealers, rows] = await Promise.all([
    listDealerIds(),
    listAuditLog({
      dealerId: sp.dealerId,
      action: sp.action,
      search: sp.search,
      from: sp.from,
      to: sp.to,
      limit: 500,
    }),
  ]);
  return (
    <ActivityClient
      dealers={dealers.map((d) => ({ id: d.id, name: d.name }))}
      rows={rows}
      initialFilters={sp}
    />
  );
}

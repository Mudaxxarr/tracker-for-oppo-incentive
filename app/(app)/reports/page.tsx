import { listDealerIds, getActiveDealerId } from "@/lib/dealer";
import { buildIncentiveReport } from "@/lib/incentive-engine/loader";
import { buildPolicyAchievements } from "@/lib/report-utils";
import { ReportsClient } from "./reports-client";
import type { PolicyAchievementEntry } from "@/lib/report-types";

interface SearchParams {
  dealerIds?: string;
  periodStart?: string;
  periodEnd?: string;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const dealers = await listDealerIds();
  const active = await getActiveDealerId();

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const periodStart = sp.periodStart ?? start;
  const periodEnd = sp.periodEnd ?? end;
  const selectedIds = sp.dealerIds ? sp.dealerIds.split(",") : active ? [active] : [];

  const reports = await Promise.all(
    selectedIds.map(async (id) => {
      const r = await buildIncentiveReport({ dealerId: id, periodStart, periodEnd });
      const d = dealers.find((x) => x.id === id);
      const policies = await buildPolicyAchievements(id, periodStart, periodEnd, r);
      return { dealerId: id, dealerName: d?.name ?? id, report: r, policies } satisfies {
        dealerId: string;
        dealerName: string;
        report: typeof r;
        policies: PolicyAchievementEntry[];
      };
    })
  );

  return (
    <ReportsClient
      dealers={dealers.map((d) => ({ id: d.id, name: d.name }))}
      initialDealerIds={selectedIds}
      initialStart={periodStart}
      initialEnd={periodEnd}
      reports={reports}
    />
  );
}

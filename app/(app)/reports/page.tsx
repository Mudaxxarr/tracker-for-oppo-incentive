import { listDealerIds, getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { buildIncentiveReport } from "@/lib/incentive-engine/loader";
import { buildPolicyAchievements } from "@/lib/report-utils";
import { getConstants } from "@/lib/settings";
import { getCrCaughtLoss } from "@/lib/db/queries/cr-caught";
import { getCrShiftedValue } from "@/lib/db/queries/purchases";
import { sumRebatesForPeriod, listRebatesForDealerInPeriod } from "@/lib/db/queries/rebates";
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

  const constants = await getConstants();
  const basePct = constants.basePercent;

  const reports = await Promise.all(
    selectedIds.map(async (id) => {
      const r = await buildIncentiveReport({ dealerId: id, periodStart, periodEnd });
      const [policies, crCaughtLoss, crShiftedValue, rebateTotal, rebateRows] = await Promise.all([
        buildPolicyAchievements(id, periodStart, periodEnd, r),
        getCrCaughtLoss(OWNER_TENANT_ID, id, periodStart, periodEnd, basePct),
        getCrShiftedValue(OWNER_TENANT_ID, id, periodStart, periodEnd),
        sumRebatesForPeriod(OWNER_TENANT_ID, id, periodStart, periodEnd),
        listRebatesForDealerInPeriod(OWNER_TENANT_ID, id, periodStart, periodEnd),
      ]);
      const d = dealers.find((x) => x.id === id);
      return { dealerId: id, dealerName: d?.name ?? id, report: r, policies, crCaughtLoss, crShiftedValue, rebateTotal, rebateRows } satisfies {
        dealerId: string;
        dealerName: string;
        report: typeof r;
        policies: PolicyAchievementEntry[];
        crCaughtLoss: typeof crCaughtLoss;
        crShiftedValue: typeof crShiftedValue;
        rebateTotal: typeof rebateTotal;
        rebateRows: typeof rebateRows;
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

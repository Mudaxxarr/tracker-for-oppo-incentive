import { getDealerDashboardStats, dealerGetModelSalesAction } from "./actions";
import { DealerDashboardClient, type DashboardData } from "./dealer-dashboard-client";
import { DaysRemainingAlert } from "./days-remaining-alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LowStockBanner } from "@/components/dealer/low-stock-banner";
import { getDealerSession } from "@/lib/dealer-auth";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { buildIncentiveReport } from "@/lib/incentive-engine/loader";
import { getCrCaughtLoss } from "@/lib/db/queries/cr-caught";
import { sumRebatesForPeriod } from "@/lib/db/queries/rebates";
import { getConstants } from "@/lib/settings";
import Link from "next/link";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Resolve the active period from ?from&to, falling back to the current month.
function resolvePeriod(sp: { from?: string; to?: string }) {
  const today = new Date();
  const mStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const mEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const from = sp.from && ISO_DATE.test(sp.from) ? sp.from : mStart;
  const to = sp.to && ISO_DATE.test(sp.to) ? sp.to : mEnd;
  // Guard against reversed ranges.
  const [startStr, endStr] = from <= to ? [from, to] : [to, from];

  const isCurrentMonth = startStr === mStart && endStr === mEnd;
  const label = isCurrentMonth
    ? new Date(startStr).toLocaleString("en-US", { month: "long", year: "numeric" })
    : `${startStr} → ${endStr}`;
  return { startStr, endStr, label };
}

// Last 6 calendar months as [start,end] ranges (oldest → newest).
function lastSixMonths() {
  const today = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return {
      label: start.toLocaleString("en-US", { month: "short" }),
      startStr: start.toISOString().slice(0, 10),
      endStr: end.toISOString().slice(0, 10),
    };
  });
}

export default async function DealerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [stats, session, constants, sp] = await Promise.all([
    getDealerDashboardStats(),
    getDealerSession(),
    getConstants(),
    searchParams,
  ]);

  const expiresAt = session?.expiresAt ?? "";
  const daysLeft = expiresAt ? differenceInCalendarDays(parseISO(expiresAt), new Date()) : 999;
  const { startStr, endStr, label } = resolvePeriod(sp);

  const totalStock = stats.stock.reduce((sum, s) => sum + s.quantity, 0);
  const dealerId = stats.dealerId;

  if (!dealerId) {
    return (
      <div className="space-y-6">
        <DaysRemainingAlert daysLeft={daysLeft} expiresAt={expiresAt} />
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Card>
          <CardHeader>
            <div className="text-base font-semibold">No active Dealer ID</div>
          </CardHeader>
          <CardContent>
            <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/dealer/ids">
              Create your first Dealer ID →
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sixMonths = lastSixMonths();

  const [report, crLoss, initialSales, rebateEarned, sixMonthEarnings] = await Promise.all([
    buildIncentiveReport({ dealerId, periodStart: startStr, periodEnd: endStr, dataTenantId: stats.tenantId }),
    getCrCaughtLoss(stats.tenantId, dealerId, startStr, endStr, constants.basePercent),
    dealerGetModelSalesAction(startStr, endStr),
    sumRebatesForPeriod(stats.tenantId, dealerId, startStr, endStr),
    Promise.all(
      sixMonths.map((m) =>
        buildIncentiveReport({ dealerId, periodStart: m.startStr, periodEnd: m.endStr, dataTenantId: stats.tenantId })
          .then((r) => r.totals.grandTotal)
          .catch(() => 0),
      ),
    ),
  ]);

  // Merge per-month earnings into the activation trend (both are last-6-months, same order).
  const sixMonthTrend = stats.sixMonthTrend.map((m, i) => ({
    label: m.label,
    activations: m.activations,
    earnings: sixMonthEarnings[i] ?? 0,
  }));

  const crFines = crLoss?.totalFines ?? 0;
  const lostIncentive = crLoss?.lostIncentive ?? 0;
  const riskExposure = lostIncentive + crFines;

  const modelsWithIncentive = new Set(
    report.rows.filter((r) => r.total > 0 || r.stockInEarned > 0).map((r) => r.modelId)
  );

  const dashData: DashboardData = {
    dealerName: stats.dealerName,
    label,
    startStr,
    endStr,
    daysLeft,
    expiresAt,
    todayActivations: stats.todayActivations,
    monthActivations: stats.monthActivations,
    periodActivations: report.totalActivations,
    purchaseRecords: stats.purchaseRecords,
    totalStock,
    pendingCrossRegion: stats.pendingCrossRegion,
    pendingInbound: stats.pendingInbound,
    rebateEarned,
    crFines,
    riskExposure,
    stock: stats.stock,
    sixMonthTrend,
    report: {
      baseIncentivePercent: report.baseIncentivePercent,
      totalActivations: report.totalActivations,
      targetBonus: {
        eligible: report.targetBonus.eligible,
        targetQty: report.targetBonus.targetQty,
        actualQty: report.targetBonus.actualQty,
        bonusPercent: report.targetBonus.bonusPercent,
      },
      totals: {
        basePercentEarned: report.totals.basePercentEarned,
        bonusPercentEarned: report.totals.bonusPercentEarned,
        activationIncentiveEarned: report.totals.activationIncentiveEarned,
        dealerIncentiveEarned: report.totals.dealerIncentiveEarned,
        stockInEarned: report.totals.stockInEarned,
        grandTotal: report.totals.grandTotal,
      },
      rows: report.rows.map((r) => ({
        modelId: r.modelId,
        modelName: r.modelName,
        qtyActivated: r.qtyActivated,
        stockInRegularQty: r.stockInRegularQty,
        basePercentEarned: r.basePercentEarned,
        total: r.total,
        stockInEarned: r.stockInEarned,
      })),
    },
    crLoss,
    initialSales,
    modelsWithIncentiveIds: [...modelsWithIncentive],
  };

  return (
    <div className="space-y-4">
      <LowStockBanner tenantId={stats.tenantId} dealerId={dealerId} />
      <DealerDashboardClient data={dashData} />
    </div>
  );
}

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
import { getConstants } from "@/lib/settings";
import Link from "next/link";

function monthBounds() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    startStr: start.toISOString().slice(0, 10),
    endStr: end.toISOString().slice(0, 10),
    label: start.toLocaleString("en-US", { month: "long", year: "numeric" }),
  };
}

export default async function DealerDashboardPage() {
  const [stats, session, constants] = await Promise.all([
    getDealerDashboardStats(),
    getDealerSession(),
    getConstants(),
  ]);

  const expiresAt = session?.expiresAt ?? "";
  const daysLeft = expiresAt ? differenceInCalendarDays(parseISO(expiresAt), new Date()) : 999;
  const { startStr, endStr, label } = monthBounds();

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

  const [report, crLoss, initialSales] = await Promise.all([
    buildIncentiveReport({ dealerId, periodStart: startStr, periodEnd: endStr, dataTenantId: stats.tenantId }),
    getCrCaughtLoss(stats.tenantId, dealerId, startStr, endStr, constants.basePercent),
    dealerGetModelSalesAction(startStr, endStr),
  ]);

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
    purchaseRecords: stats.purchaseRecords,
    totalStock,
    pendingCrossRegion: stats.pendingCrossRegion,
    pendingInbound: stats.pendingInbound,
    stock: stats.stock,
    sixMonthTrend: stats.sixMonthTrend,
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

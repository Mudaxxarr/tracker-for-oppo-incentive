import { getDealerDashboardStats, dealerGetModelSalesAction } from "./actions";
import { DealerDashboardClient, type DashboardData } from "./dealer-dashboard-client";
import { DaysRemainingAlert } from "./days-remaining-alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LowStockBanner } from "@/components/dealer/low-stock-banner";
import { DealerWarnings } from "@/components/dealer/dealer-warnings";
import { getDealerSession } from "@/lib/dealer-auth";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { buildIncentiveReport } from "@/lib/incentive-engine/loader";
import { getCrCaughtLoss } from "@/lib/db/queries/cr-caught";
import { sumRebatesForPeriod } from "@/lib/db/queries/rebates";
import { getConstants } from "@/lib/settings";
import { db, schema } from "@/lib/db/client";
import { PURCHASE_REVIEW_STATUS } from "@/lib/constants";
import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import Link from "next/link";
import { listActivations } from "@/lib/db/queries/activations";
import { groupActivationsByDate } from "@/lib/activations/activation-stats";
import { computePreviousPeriod, percentChange } from "@/lib/purchases/purchase-stats";

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
  const prevPeriod = computePreviousPeriod(startStr, endStr);

  const today = new Date();
  const last7Start = new Date(today);
  last7Start.setDate(last7Start.getDate() - 6);
  const last7StartStr = last7Start.toISOString().slice(0, 10);
  const last7EndStr = today.toISOString().slice(0, 10);

  const [report, crLoss, initialSales, rebateEarned, sixMonthEarnings, periodPurchaseQtyRows, stockOldestRaw, prevReport, prevRebateEarned, last7Activations] = await Promise.all([
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
    db
      .select({ qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
      .from(schema.purchases)
      .where(
        and(
          eq(schema.purchases.tenantId, stats.tenantId),
          eq(schema.purchases.dealerId, dealerId),
          gte(schema.purchases.purchaseDate, startStr),
          lte(schema.purchases.purchaseDate, endStr),
          ne(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW),
        ),
      ),
    db
      .select({
        modelId: schema.purchases.modelId,
        oldest: sql<string>`MIN(${schema.purchases.purchaseDate})`,
      })
      .from(schema.purchases)
      .where(
        and(
          eq(schema.purchases.tenantId, stats.tenantId),
          eq(schema.purchases.dealerId, dealerId),
          ne(schema.purchases.reviewStatus, PURCHASE_REVIEW_STATUS.PENDING_REVIEW),
        ),
      )
      .groupBy(schema.purchases.modelId),
    buildIncentiveReport({ dealerId, periodStart: prevPeriod.from, periodEnd: prevPeriod.to, dataTenantId: stats.tenantId }).catch(() => null),
    sumRebatesForPeriod(stats.tenantId, dealerId, prevPeriod.from, prevPeriod.to),
    listActivations({ tenantId: stats.tenantId, dealerId, from: last7StartStr, to: last7EndStr }),
  ]);

  // Total Receivable = bonus/incentive earned + price-drop refunds, before fines —
  // matches the existing "Total before fines" figure shown in the net-payout card.
  const totalReceivable = report.totals.grandTotal + rebateEarned;
  const prevTotalReceivable = (prevReport?.totals.grandTotal ?? 0) + prevRebateEarned;
  const totalReceivableGrowthPercent = percentChange(totalReceivable, prevTotalReceivable);

  // Last 7 calendar days of net sales value (qty x price) and activation count,
  // zero-filled so every day shows even with no activity that day.
  const last7Groups = groupActivationsByDate(
    last7Activations.map((a) => ({
      modelId: a.modelId,
      modelName: a.modelName,
      activationDate: a.activationDate,
      dealerPriceSnapshot: a.dealerPriceSnapshot,
      isCrossRegion: a.isCrossRegion,
    })),
  );
  const last7GroupsByDate = new Map(last7Groups.map((g) => [g.date, g]));
  const last7DaysTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(last7Start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const group = last7GroupsByDate.get(dateStr);
    return {
      date: dateStr,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      netSales: group?.totalDealerValue ?? 0,
      activations: group?.count ?? 0,
    };
  });

  // Merge per-month earnings into the activation trend (both are last-6-months, same order).
  const sixMonthTrend = stats.sixMonthTrend.map((m, i) => ({
    label: m.label,
    activations: m.activations,
    earnings: sixMonthEarnings[i] ?? 0,
  }));

  const crFines = crLoss?.totalFines ?? 0;
  const lostIncentive = crLoss?.lostIncentive ?? 0;
  const riskExposure = lostIncentive + crFines;
  const periodPurchaseUnits = Number(periodPurchaseQtyRows[0]?.qty ?? 0);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const agedCutoff = cutoff.toISOString().slice(0, 10);
  const oldestByModel = new Map(stockOldestRaw.map((r) => [r.modelId, r.oldest]));
  const agedStock = stats.stock.reduce(
    (acc, item) => {
      const oldest = oldestByModel.get(item.modelId);
      if (!oldest || oldest > agedCutoff) return acc;
      return {
        units: acc.units + item.quantity,
        value: acc.value + item.quantity * (item.dealerPrice ?? 0),
        modelCount: acc.modelCount + 1,
      };
    },
    { units: 0, value: 0, modelCount: 0 },
  );

  const modelsWithIncentive = new Set(
    report.rows.filter((r) => r.total > 0 || r.stockInEarned > 0).map((r) => r.modelId)
  );

  // Period net sales value = qty x dealer price across every model/price window —
  // the actual Rs value of units activated this period (distinct from the
  // incentive/receivable figures, which are bonus payouts, not sales value).
  const periodNetSalesValue = report.rows.reduce(
    (sum, r) => sum + r.priceSubperiods.reduce((s, p) => s + p.qty * p.dealerPrice, 0),
    0,
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
    periodPurchaseUnits,
    agedStock,
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
    totalReceivable,
    totalReceivableGrowthPercent,
    periodNetSalesValue,
    last7DaysTrend,
  };

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Dealer dashboard</h1>
      <LowStockBanner tenantId={stats.tenantId} dealerId={dealerId} />
      {session?.role === "admin" ? <DealerWarnings tenantId={stats.tenantId} dealerId={dealerId} /> : null}
      <DealerDashboardClient data={dashData} />
    </div>
  );
}

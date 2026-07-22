import { getActiveDealer, listDealerIds, OWNER_TENANT_ID } from "@/lib/dealer";
import { buildIncentiveReport, buildLastSixMonths } from "@/lib/incentive-engine/loader";
import { countPendingCrossRegion, listInterIdTransfers } from "@/lib/db/queries/transfers";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { getCrCaughtLoss } from "@/lib/db/queries/cr-caught";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/feature/kpi-card";
import { TrendCharts } from "@/components/feature/trend-charts";
import { Badge } from "@/components/ui/badge";
import { DashboardAnalytics } from "@/app/(app)/dashboard/dashboard-analytics";
import { getModelSalesAction } from "@/app/(app)/dashboard/actions";
import {
  Smartphone,
  Percent,
  Award,
  Truck,
  Wallet,
  ArrowLeftRight,
  ArrowRight,
  Package,
  ShieldAlert,
} from "lucide-react";
import { formatPKR } from "@/lib/format";
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

export default async function TeamDashboardPage() {
  const dealer = await getActiveDealer();
  if (!dealer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active Dealer ID</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Ask your admin to set up a Dealer ID.</p>
        </CardContent>
      </Card>
    );
  }

  const { startStr, endStr, label } = monthBounds();

  const [report, sixMonths, pendingCount, stock, transfers, allDealers, initialSales, crLoss] =
    await Promise.all([
      buildIncentiveReport({ dealerId: dealer.id, periodStart: startStr, periodEnd: endStr }),
      buildLastSixMonths(dealer.id),
      countPendingCrossRegion(OWNER_TENANT_ID, dealer.id),
      listStockForDealer(OWNER_TENANT_ID, dealer.id),
      listInterIdTransfers(OWNER_TENANT_ID, dealer.id),
      listDealerIds(),
      getModelSalesAction(startStr, endStr),
      getCrCaughtLoss(OWNER_TENANT_ID, dealer.id, startStr, endStr),
    ]);

  const tb = report.targetBonus;

  const dealerNameById = new Map(allDealers.map((d) => [d.id, d.name]));
  const movedTo = new Map<string, string[]>();
  for (const t of transfers) {
    if (t.fromDealerId === dealer.id) {
      const destName = dealerNameById.get(t.toDealerId) ?? "another ID";
      const cur = movedTo.get(t.modelId) ?? [];
      if (!cur.includes(destName)) cur.push(destName);
      movedTo.set(t.modelId, cur);
    }
  }

  const modelsWithIncentive = new Set(
    report.rows.filter((r) => r.total > 0 || r.stockInEarned > 0).map((r) => r.modelId)
  );
  const stockWithIncentive = stock.filter((s) => modelsWithIncentive.has(s.modelId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            <strong>{dealer.name}</strong> — {label}
          </p>
        </div>
        {pendingCount > 0 ? (
          <Link href="/team/cross-region">
            <Badge variant="outline" className="gap-1">
              <ArrowLeftRight className="size-3" />
              {pendingCount} pending cross-region
            </Badge>
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Active phones this month"
          value={report.totalActivations}
          icon={<Smartphone className="size-4" />}
        />
        <KpiCard
          label={`${report.baseIncentivePercent}% earned`}
          value={report.totals.basePercentEarned}
          format="currency"
          icon={<Percent className="size-4" />}
        />
        <KpiCard
          label={`Target bonus ${tb.bonusPercent}%`}
          value={report.totals.bonusPercentEarned}
          format="currency"
          icon={<Award className="size-4" />}
          highlightZero
          progress={
            tb.targetQty != null
              ? { current: tb.actualQty, target: tb.targetQty }
              : undefined
          }
          helper={tb.eligible ? "Purchase target met ✓" : `${tb.actualQty}/${tb.targetQty ?? "—"} purchased`}
        />
        <KpiCard
          label="Stock-In earned"
          value={report.totals.stockInEarned}
          format="currency"
          icon={<Truck className="size-4" />}
        />
        <KpiCard
          label="Total expected from OPPO"
          value={report.totals.grandTotal}
          format="currency"
          icon={<Wallet className="size-4" />}
        />
        <KpiCard
          label="Potential incentive loss (est.)"
          value={report.potentialLoss.total}
          format="currency"
          icon={<ShieldAlert className="size-4" />}
          highlightZero
          helper={crLoss.totalUnits > 0 ? `${crLoss.totalUnits} units caught` : "No catches this month"}
        />
      </div>

      <TrendCharts data={sixMonths} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4" />
            Current Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stock.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No stock on hand.</div>
          ) : (
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {stock.map((s) => {
                const moved = movedTo.get(s.modelId);
                const hasIncentive = modelsWithIncentive.has(s.modelId);
                return (
                  <div key={s.modelId} className="flex flex-col gap-1 bg-card p-3">
                    <span className="truncate text-xs font-medium leading-tight">{s.modelName}</span>
                    <span className="text-2xl font-bold tabular-nums text-foreground">{s.quantity}</span>
                    <div className="flex flex-wrap gap-1">
                      {s.dealerPrice != null ? (
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {formatPKR(s.dealerPrice)}
                        </span>
                      ) : null}
                      {moved ? (
                        <span className="flex items-center gap-0.5 text-[10px] text-blue-500">
                          <ArrowRight className="size-2.5" />
                          {moved.join(", ")}
                        </span>
                      ) : null}
                      {!hasIncentive ? (
                        <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">
                          no incentive
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {stockWithIncentive.length > 0 || report.rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incentive models — {label}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {report.rows.filter((r) => r.total > 0 || r.stockInEarned > 0).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No incentive earned yet this month.
                </div>
              ) : (
                report.rows
                  .filter((r) => r.total > 0 || r.stockInEarned > 0)
                  .sort((a, b) => b.qtyActivated - a.qtyActivated)
                  .map((row) => (
                    <div key={row.modelId} className="flex items-center justify-between p-4">
                      <div>
                        <div className="font-medium">{row.modelName}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.qtyActivated} activated · {row.stockInRegularQty} stocked
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium tabular-nums">{formatPKR(row.total)}</div>
                        <div className="text-xs text-muted-foreground">
                          4% {formatPKR(row.basePercentEarned)}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <DashboardAnalytics initialRows={initialSales} initialFrom={startStr} initialTo={endStr} />
    </div>
  );
}

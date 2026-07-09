import { getActiveDealer, listDealerIds, OWNER_TENANT_ID } from "@/lib/dealer";
import { buildIncentiveReport, buildLastSixMonths } from "@/lib/incentive-engine/loader";
import { countPendingCrossRegion, listInterIdTransfers, sumCrFinesForPeriod } from "@/lib/db/queries/transfers";
import { listStockForDealer, getCrStockSummary } from "@/lib/db/queries/purchases";
import { getCrCaughtLoss, listCrCaughtForPeriod } from "@/lib/db/queries/cr-caught";
import { sumRebatesForPeriod, listRebatesForDealerInPeriod } from "@/lib/db/queries/rebates";
import { db, schema } from "@/lib/db/client";
import { and, eq, sql } from "drizzle-orm";
import { getConstants } from "@/lib/settings";
import { isAuthenticated } from "@/lib/auth";
import { TEST_SANDBOX_TENANT_ID } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardClient } from "./dashboard-analytics";
import { ViewSwitcher } from "./view-switcher";
import { getModelSalesAction } from "./actions";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { formatPKR } from "@/lib/format";

function fmtLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthBounds() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { startStr: fmtLocal(start), endStr: fmtLocal(end) };
}

export default async function DashboardPage() {
  const dealer = await getActiveDealer();
  if (!dealer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active Dealer ID</CardTitle>
        </CardHeader>
        <CardContent>
          <Link className="text-sm underline" href="/ids">
            Create your first Dealer ID →
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { startStr, endStr } = monthBounds();
  const constants = await getConstants();

  const [report, sixMonths, pendingCount, stock, transfers, allDealers, initialSales, crLoss, crStock, initialRebateTotal, initialRebateRowsFull, stockOldestRaw, initialCrFineTotal, initialCrCaughtRows] =
    await Promise.all([
      buildIncentiveReport({ dealerId: dealer.id, periodStart: startStr, periodEnd: endStr }),
      buildLastSixMonths(dealer.id),
      countPendingCrossRegion(OWNER_TENANT_ID, dealer.id),
      listStockForDealer(OWNER_TENANT_ID, dealer.id),
      listInterIdTransfers(OWNER_TENANT_ID, dealer.id),
      listDealerIds(),
      getModelSalesAction(startStr, endStr),
      getCrCaughtLoss(OWNER_TENANT_ID, dealer.id, startStr, endStr, constants.basePercent),
      getCrStockSummary(OWNER_TENANT_ID, dealer.id),
      sumRebatesForPeriod(OWNER_TENANT_ID, dealer.id, startStr, endStr),
      listRebatesForDealerInPeriod(OWNER_TENANT_ID, dealer.id, startStr, endStr),
      db.select({ modelId: schema.purchases.modelId, oldest: sql<string>`MIN(${schema.purchases.purchaseDate})` })
        .from(schema.purchases)
        .where(and(eq(schema.purchases.tenantId, OWNER_TENANT_ID), eq(schema.purchases.dealerId, dealer.id)))
        .groupBy(schema.purchases.modelId),
      sumCrFinesForPeriod(OWNER_TENANT_ID, dealer.id, startStr, endStr),
      listCrCaughtForPeriod(OWNER_TENANT_ID, dealer.id, startStr, endStr),
    ]);

  const initialRebateRows = initialRebateRowsFull.map((r) => ({
    modelName: r.modelName,
    eligibleQty: r.eligibleQty,
    rebatePerUnit: r.rebatePerUnit,
  }));
  const stockOldestDate: Record<string, string> = Object.fromEntries(
    stockOldestRaw.map((r) => [r.modelId, r.oldest])
  );

  // Pre-compute transfer destinations as a plain object (serializable across server/client)
  const dealerNameById = new Map(allDealers.map((d) => [d.id, d.name]));
  const movedTo: Record<string, string[]> = {};
  for (const t of transfers) {
    if (t.fromDealerId === dealer.id) {
      const destName = dealerNameById.get(t.toDealerId) ?? "another ID";
      const cur = movedTo[t.modelId] ?? [];
      if (!cur.includes(destName)) cur.push(destName);
      movedTo[t.modelId] = cur;
    }
  }

  const totalCrRemaining = crStock.reduce((s, r) => s + r.crRemaining, 0);

  const isOwner = await isAuthenticated();

  return (
    <div className="space-y-4">
      {isOwner && (
        <div className="flex justify-end">
          <ViewSwitcher testTenantId={TEST_SANDBOX_TENANT_ID} />
        </div>
      )}
      {crStock.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
              <ArrowLeftRight className="size-4" />
              Cross-Region Stock in This ID
              <span className="ml-auto rounded-full bg-blue-700 px-2 py-0.5 text-xs font-bold text-white">
                {totalCrRemaining} unit{totalCrRemaining !== 1 ? "s" : ""} remaining
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-3">
              {crStock.map((r) => (
                <div key={r.modelId} className="rounded-md border border-blue-200 bg-white px-3 py-2 text-xs dark:border-blue-700 dark:bg-background">
                  <p className="font-medium">{r.modelName}</p>
                  <p className="text-muted-foreground">
                    {r.crRemaining} remaining · {r.crActivated}/{r.crPurchased} activated
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-blue-700 dark:text-blue-400">
              The system automatically tags the most-recent activations as cross-region when regular stock is exhausted.
            </p>
          </CardContent>
        </Card>
      )}
      <DashboardClient
        dealerName={dealer.name}
        initialFrom={startStr}
        initialTo={endStr}
        initialReport={report}
        initialModelSales={initialSales}
        initialCrLoss={crLoss}
        initialRebateTotal={initialRebateTotal}
        initialRebateRows={initialRebateRows}
        stockOldestDate={stockOldestDate}
        sixMonths={sixMonths}
        stock={stock}
        movedTo={movedTo}
        pendingCount={pendingCount}
        initialCrFineTotal={initialCrFineTotal}
        initialCrCaughtRows={initialCrCaughtRows}
      />
    </div>
  );
}

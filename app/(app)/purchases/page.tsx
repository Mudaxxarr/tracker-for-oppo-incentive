import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listPurchases, listPurchaseBills, getPurchaseOverviewStats, listStockForDealer } from "@/lib/db/queries/purchases";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { PurchasesClient } from "./purchases-client";

interface SearchParams {
  modelId?: string;
  source?: string;
  from?: string;
  to?: string;
  page?: string;
}

const BILLS_PAGE_SIZE = 5;

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { from, to };
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const dealerId = await getActiveDealerId();
  const sp = await searchParams;
  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);

  // No "all sources" option in the UI — default to Regular so cross-region
  // purchases only show up when the dealer deliberately switches the filter.
  const source = (sp.source as "REGULAR" | "CROSS_REGION_TRANSFER_IN" | undefined) || PURCHASE_SOURCE.REGULAR;
  const page = Math.max(1, Number(sp.page) || 1);
  // The Records/Filters card has no default range (shows all history when unset).
  // The Overview/Daily-Purchase views default to the current calendar month so the
  // KPI cards and chart always have a bounded, meaningful window.
  const defaultRange = currentMonthRange();
  const overviewFrom = sp.from || defaultRange.from;
  const overviewTo = sp.to || defaultRange.to;

  const [purchases, billsResult, overview, stock] = await Promise.all([
    dealerId
      ? listPurchases({ tenantId: OWNER_TENANT_ID, dealerId, modelId: sp.modelId || undefined, source, from: sp.from || undefined, to: sp.to || undefined })
      : Promise.resolve([]),
    dealerId
      ? listPurchaseBills({ tenantId: OWNER_TENANT_ID, dealerId, modelId: sp.modelId || undefined, source, from: overviewFrom, to: overviewTo, page, pageSize: BILLS_PAGE_SIZE })
      : Promise.resolve({ bills: [], total: 0 }),
    dealerId
      ? getPurchaseOverviewStats({ tenantId: OWNER_TENANT_ID, dealerId, modelId: sp.modelId || undefined, source, from: overviewFrom, to: overviewTo })
      : Promise.resolve(null),
    dealerId ? listStockForDealer(OWNER_TENANT_ID, dealerId) : Promise.resolve([]),
  ]);

  const lowStockCount = stock.filter((s) => {
    const model = models.find((m) => m.id === s.modelId);
    return model?.lowStockThreshold != null && s.quantity < model.lowStockThreshold;
  }).length;

  return (
    <PurchasesClient
      models={models}
      initialPurchases={purchases}
      initialFilters={{ ...sp, source }}
      hasDealer={!!dealerId}
      bills={billsResult.bills}
      billsTotal={billsResult.total}
      billsPage={page}
      billsPageSize={BILLS_PAGE_SIZE}
      overview={overview}
      overviewRange={{ from: overviewFrom, to: overviewTo }}
      lowStockCount={lowStockCount}
    />
  );
}

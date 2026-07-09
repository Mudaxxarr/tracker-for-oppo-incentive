import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { isFeatureKeyOn } from "@/lib/feature-registry";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { listPurchases, listPurchaseBills, getPurchaseOverviewStats } from "@/lib/db/queries/purchases";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { DealerPurchasesClient } from "./dealer-purchases-client";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { getTenantById } from "@/lib/dealer-tenant";

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

export default async function DealerPurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "purchases")) return <FeatureDisabled />;

  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  const sp = await searchParams;

  // Regular-only by default (cross-region shows only when explicitly filtered).
  const source = (sp.source as "REGULAR" | "CROSS_REGION_TRANSFER_IN" | undefined) || PURCHASE_SOURCE.REGULAR;
  const page = Math.max(1, Number(sp.page) || 1);
  const defaultRange = currentMonthRange();
  const overviewFrom = sp.from || defaultRange.from;
  const overviewTo = sp.to || defaultRange.to;

  const [models, purchases, billsResult, overview, tenant] = await Promise.all([
    listModelsWithCurrentPrice(OWNER_TENANT_ID),
    dealerId
      ? listPurchases({ tenantId: session.tenantId, dealerId, modelId: sp.modelId || undefined, source, from: sp.from || undefined, to: sp.to || undefined })
      : Promise.resolve([]),
    dealerId
      ? listPurchaseBills({ tenantId: session.tenantId, dealerId, modelId: sp.modelId || undefined, source, from: overviewFrom, to: overviewTo, page, pageSize: BILLS_PAGE_SIZE })
      : Promise.resolve({ bills: [], total: 0 }),
    dealerId
      ? getPurchaseOverviewStats({ tenantId: session.tenantId, dealerId, modelId: sp.modelId || undefined, source, from: overviewFrom, to: overviewTo })
      : Promise.resolve(null),
    getTenantById(session.tenantId),
  ]);
  const backdateDays = tenant?.backdateDays ?? 3;

  return (
    <DealerPurchasesClient
      models={models}
      initialPurchases={purchases}
      initialFilters={{ ...sp, source }}
      hasDealer={!!dealerId}
      dealerId={dealerId}
      tenantId={session.tenantId}
      role={session.role as "admin" | "exec"}
      backdateDays={backdateDays}
      canBulk={isFeatureKeyOn(features, "pur_bulk")}
      canOverview={isFeatureKeyOn(features, "pur_overview")}
      bills={billsResult.bills}
      billsTotal={billsResult.total}
      billsPageSize={BILLS_PAGE_SIZE}
      overview={overview}
      overviewRange={{ from: overviewFrom, to: overviewTo }}
    />
  );
}

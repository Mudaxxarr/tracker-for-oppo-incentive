import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { isAddonEnabled } from "@/lib/dealer-addons";
import { isFeatureKeyOn } from "@/lib/feature-registry";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { buildIncentiveReport } from "@/lib/incentive-engine/loader";
import { buildPolicyAchievements } from "@/lib/report-utils";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { DealerReportsClient } from "./dealer-reports-client";

interface SearchParams {
  periodStart?: string;
  periodEnd?: string;
}

export default async function DealerReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "reports")) return <FeatureDisabled />;

  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  const addons = {
    detailedPdf: isAddonEnabled(features, "addon_detailed_pdf"),
    excel: isAddonEnabled(features, "addon_excel"),
    incentivePdf: isFeatureKeyOn(features, "rep_incentive_pdf"),
  };

  const sp = await searchParams;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const periodStart = sp.periodStart ?? start;
  const periodEnd = sp.periodEnd ?? end;

  if (!dealerId) {
    return (
      <DealerReportsClient
        dealerName="—"
        initialStart={periodStart}
        initialEnd={periodEnd}
        report={null}
        policies={[]}
        hasDealer={false}
        addons={addons}
      />
    );
  }

  const [dealerRow, report] = await Promise.all([
    db
      .select({ name: schema.dealerIds.name })
      .from(schema.dealerIds)
      .where(eq(schema.dealerIds.id, dealerId))
      .limit(1),
    buildIncentiveReport({ dealerId, periodStart, periodEnd, dataTenantId: session.tenantId }),
  ]);
  const dealerName = dealerRow[0]?.name ?? "My ID";

  const policies = await buildPolicyAchievements(dealerId, periodStart, periodEnd, report);

  return (
    <DealerReportsClient
      dealerName={dealerName}
      initialStart={periodStart}
      initialEnd={periodEnd}
      report={report}
      policies={policies}
      hasDealer={true}
      addons={addons}
    />
  );
}

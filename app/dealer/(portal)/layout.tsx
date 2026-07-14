import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { DealerTopBar } from "@/components/dealer/dealer-top-bar";
import { DealerSidebar } from "@/components/dealer/dealer-sidebar";
import { DealerBottomNav } from "@/components/dealer/dealer-bottom-nav";
import { DealerGraceBanner } from "@/components/dealer/dealer-grace-banner";
import { DealerExpiryWarning } from "@/components/dealer/dealer-expiry-warning";
import { ensureTodayBackup } from "@/lib/admin/backups";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isAuthenticated } from "@/lib/auth";
import { AdminPreviewBanner } from "@/components/dealer/admin-preview-banner";
import { TEST_SANDBOX_TENANT_ID } from "@/lib/constants";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { OfflineSync } from "@/components/pwa/offline-sync";
import { DealerTour } from "@/components/dealer/dealer-tour";
import { DealerBackHandler } from "@/components/dealer/dealer-back-handler";
import { ADMIN_PREVIEW_RETURN_COOKIE } from "@/lib/constants";

export default async function DealerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  if (session.status === "expired" || session.status === "suspended") {
    redirect("/dealer/expired");
  }

  ensureTodayBackup(session.tenantId).catch((err) =>
    console.error("ensureTodayBackup failed:", err),
  );

  const [tenantRows, features, isAdminPreview, activeDealerId] = await Promise.all([
    db
      .select({ businessName: schema.dealerTenants.businessName })
      .from(schema.dealerTenants)
      .where(eq(schema.dealerTenants.id, session.tenantId))
      .limit(1),
    getTenantFeaturesById(session.tenantId),
    isAuthenticated(),
    getActiveDealerIdForTenant(session.tenantId),
  ]);
  const businessName = tenantRows[0]?.businessName ?? "Dealer Portal";

  // Top bar shows the active Dealer ID's shop name when set.
  let shopName: string | null = null;
  if (activeDealerId) {
    const shopRows = await db
      .select({ shopName: schema.dealerIds.shopName })
      .from(schema.dealerIds)
      .where(eq(schema.dealerIds.id, activeDealerId))
      .limit(1);
    shopName = shopRows[0]?.shopName ?? null;
  }

  const headerStore = await headers();
  const cookieStore = await cookies();
  const adminPreviewReturnTo = cookieStore.get(ADMIN_PREVIEW_RETURN_COOKIE)?.value;
  const isGrace = headerStore.get("x-grace") === "true";
  const expirySoonDays = Number(headerStore.get("x-expiry-soon") ?? "0") || null;

  return (
    <div className="flex min-h-screen flex-col">
      {isAdminPreview && (
        <AdminPreviewBanner
          tenantId={session.tenantId}
          businessName={businessName}
          returnTo={adminPreviewReturnTo}
        />
      )}
      <DealerTopBar
        businessName={businessName}
        shopName={shopName}
        isAdmin={isAdminPreview}
        showViewSwitcher={session.tenantId === TEST_SANDBOX_TENANT_ID}
      />
      {expirySoonDays && <DealerExpiryWarning daysLeft={expirySoonDays} />}
      {isGrace && <DealerGraceBanner />}
      <div className="flex flex-1">
        <DealerSidebar features={features} role={session.role} />
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <div className="px-3 py-4 md:px-6 md:py-6">{children}</div>
        </main>
      </div>
      <DealerBottomNav features={features} role={session.role} />
      <InstallPrompt />
      <OfflineSync />
      <DealerBackHandler />
      <Suspense fallback={null}>
        <DealerTour />
      </Suspense>
    </div>
  );
}

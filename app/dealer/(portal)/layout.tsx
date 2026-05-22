import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDealerSession } from "@/lib/dealer-auth";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { DealerTopBar } from "@/components/dealer/dealer-top-bar";
import { DealerSidebar } from "@/components/dealer/dealer-sidebar";
import { DealerBottomNav } from "@/components/dealer/dealer-bottom-nav";
import { DealerGraceBanner } from "@/components/dealer/dealer-grace-banner";
import { ensureTodayBackup } from "@/lib/admin/backups";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isAuthenticated } from "@/lib/auth";
import { AdminPreviewBanner } from "@/components/dealer/admin-preview-banner";
import { InstallPrompt } from "@/components/pwa/install-prompt";

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

  const [tenantRows, features, isAdminPreview] = await Promise.all([
    db
      .select({ businessName: schema.dealerTenants.businessName })
      .from(schema.dealerTenants)
      .where(eq(schema.dealerTenants.id, session.tenantId))
      .limit(1),
    getTenantFeaturesById(session.tenantId),
    isAuthenticated(),
  ]);
  const businessName = tenantRows[0]?.businessName ?? "Dealer Portal";

  const headerStore = await headers();
  const isGrace = headerStore.get("x-grace") === "true";

  return (
    <div className="flex min-h-screen flex-col">
      {isAdminPreview && (
        <AdminPreviewBanner
          tenantId={session.tenantId}
          businessName={businessName}
        />
      )}
      <DealerTopBar businessName={businessName} isAdmin={isAdminPreview} />
      {isGrace && <DealerGraceBanner />}
      <div className="flex flex-1">
        <DealerSidebar features={features} />
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <div className="px-3 py-4 md:px-6 md:py-6">{children}</div>
        </main>
      </div>
      <DealerBottomNav features={features} />
      <InstallPrompt />
    </div>
  );
}

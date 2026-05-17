import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDealerSession } from "@/lib/dealer-auth";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { DealerTopBar } from "@/components/dealer/dealer-top-bar";
import { DealerSidebar } from "@/components/dealer/dealer-sidebar";
import { DealerBottomNav } from "@/components/dealer/dealer-bottom-nav";
import { DealerGraceBanner } from "@/components/dealer/dealer-grace-banner";

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

  const tenantRows = await db
    .select({ businessName: schema.dealerTenants.businessName })
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, session.tenantId))
    .limit(1);
  const businessName = tenantRows[0]?.businessName ?? "Dealer Portal";

  const headerStore = await headers();
  const isGrace = headerStore.get("x-grace") === "true";

  return (
    <div className="flex min-h-screen flex-col">
      <DealerTopBar businessName={businessName} />
      {isGrace && <DealerGraceBanner />}
      <div className="flex flex-1">
        <DealerSidebar />
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <div className="px-3 py-4 md:px-6 md:py-6">{children}</div>
        </main>
      </div>
      <DealerBottomNav />
    </div>
  );
}

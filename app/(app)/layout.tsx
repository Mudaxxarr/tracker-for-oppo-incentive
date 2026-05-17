import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listDealerIds, getActiveDealerId } from "@/lib/dealer";
import { TopBar } from "@/components/feature/top-bar";
import { Sidebar } from "@/components/feature/sidebar";
import { BottomNav } from "@/components/feature/bottom-nav";
import { PageTransition } from "@/components/feature/page-transition";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) {
    redirect("/unlock");
  }

  const dealers = await listDealerIds();
  const activeDealerId = await getActiveDealerId();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        dealers={dealers.map((d) => ({ id: d.id, name: d.name }))}
        activeDealerId={activeDealerId}
      />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <PageTransition>
            <div className="px-3 py-4 md:px-6 md:py-6">{children}</div>
          </PageTransition>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

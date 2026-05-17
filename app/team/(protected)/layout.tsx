import { redirect } from "next/navigation";
import { isAnyAuthenticated } from "@/lib/auth";
import { TeamTopBar } from "@/components/feature/team-top-bar";
import { TeamSidebar } from "@/components/feature/team-sidebar";
import { TeamBottomNav } from "@/components/feature/team-bottom-nav";
import { PageTransition } from "@/components/feature/page-transition";

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAnyAuthenticated())) {
    redirect("/team/unlock");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TeamTopBar />
      <div className="flex flex-1">
        <TeamSidebar />
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <PageTransition>
            <div className="px-3 py-4 md:px-6 md:py-6">{children}</div>
          </PageTransition>
        </main>
      </div>
      <TeamBottomNav />
    </div>
  );
}

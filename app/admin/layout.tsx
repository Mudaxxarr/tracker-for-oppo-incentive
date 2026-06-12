import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { TopBar } from "@/components/feature/top-bar";
import { countAllUnreadAlerts } from "@/lib/db/queries/alerts";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const unreadAlerts = await countAllUnreadAlerts();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar dealers={[]} activeDealerId={null} />
      <div className="flex flex-1">
        <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-muted/20">
          <nav className="flex flex-col gap-1 p-3">
            {[
              { href: "/admin/dealers", label: "Dealers", badge: null },
              { href: "/admin/revenue", label: "Revenue", badge: null },
              { href: "/admin/rollout", label: "Rollout", badge: null },
              { href: "/admin/alerts", label: "Alerts", badge: unreadAlerts > 0 ? unreadAlerts : null },
              { href: "/admin/staff", label: "Staff", badge: null },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span>{item.label}</span>
                {item.badge !== null && (
                  <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                    {item.badge}
                  </span>
                )}
              </a>
            ))}
          </nav>
        </aside>
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <div className="px-3 py-4 md:px-6 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { TopBar } from "@/components/feature/top-bar";
import { countAllUnreadAlerts } from "@/lib/db/queries/alerts";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const unreadAlerts = await countAllUnreadAlerts();
  const navItems = [
    { href: "/admin", label: "Home", badge: null },
    { href: "/admin/dealers", label: "Dealers", badge: null },
    { href: "/admin/revenue", label: "Revenue", badge: null },
    { href: "/admin/previews", label: "Features", badge: null },
    { href: "/admin/rollout", label: "Rollout", badge: null },
    { href: "/admin/alerts", label: "Alerts", badge: unreadAlerts > 0 ? unreadAlerts : null },
    { href: "/admin/staff", label: "Staff", badge: null },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar dealers={[]} activeDealerId={null} />
      <AdminMobileNav items={navItems} />
      <div className="flex flex-1">
        <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-muted/20">
          <AdminNav items={navItems} />
        </aside>
        <main className="flex flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          <div className="px-3 py-4 md:px-6 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

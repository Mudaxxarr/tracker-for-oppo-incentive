import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getRevenueSummary } from "@/lib/admin/dealers";
import { countAllUnreadAlerts } from "@/lib/db/queries/alerts";
import { AdminDashboardHero } from "./admin-dashboard-hero";
import Link from "next/link";
import { Users, BarChart2, Sparkles, Bell, UserCog, Repeat } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminPage() {
  if (!(await isAuthenticated())) redirect("/login");

  const [revenue, unreadAlerts] = await Promise.all([
    getRevenueSummary(),
    countAllUnreadAlerts(),
  ]);

  const expiringDealers = revenue.tenants
    .filter((t) => t.status !== "suspended" && t.status !== "expired")
    .filter((t) => {
      const days = differenceInDays(parseISO(t.expiresAt), new Date());
      return days >= 0 && days <= 30;
    })
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

  const quickLinks = [
    { href: "/admin/dealers", label: "Dealers", icon: Users, badge: revenue.total, sub: `${revenue.active} active` },
    { href: "/admin/revenue", label: "Revenue", icon: BarChart2, badge: null, sub: "Billing & MRR" },
    { href: "/admin/previews", label: "Features", icon: Sparkles, badge: null, sub: "Trials & add-ons" },
    { href: "/admin/alerts", label: "Alerts", icon: Bell, badge: unreadAlerts > 0 ? unreadAlerts : null, sub: unreadAlerts > 0 ? `${unreadAlerts} unread` : "All clear" },
    { href: "/admin/rollout", label: "Rollout", icon: Repeat, badge: null, sub: "Feature flags" },
    { href: "/admin/staff", label: "Staff", icon: UserCog, badge: null, sub: "Admin users" },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <AdminDashboardHero
        data={{
          active: revenue.active,
          mrr: revenue.mrr,
          collectedThisMonth: revenue.collectedThisMonth,
          expiringIn7: revenue.expiringIn7,
          expiringSoon: revenue.expiringSoon,
          grace: revenue.grace,
          suspended: revenue.suspended,
          total: revenue.total,
          unreadAlerts,
        }}
      />

      {/* Quick links grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {quickLinks.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group relative flex flex-col gap-1 rounded-xl border bg-card p-4 transition-all duration-150 hover:border-primary/30 hover:bg-primary/5 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <q.icon className="size-4 text-muted-foreground transition-colors duration-150 group-hover:text-primary" />
              {q.badge !== null && (
                <span className="flex min-w-[20px] h-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {q.badge}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-semibold">{q.label}</p>
            <p className="text-xs text-muted-foreground">{q.sub}</p>
          </Link>
        ))}
      </div>

      {/* Expiring soon */}
      {expiringDealers.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Expiring Soon</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {expiringDealers.length} dealers
            </span>
          </div>
          <div className="divide-y">
            {expiringDealers.map((t) => {
              const days = differenceInDays(parseISO(t.expiresAt), new Date());
              return (
                <Link
                  key={t.id}
                  href={`/admin/dealers/${t.id}/renew`}
                  className="flex min-h-[52px] items-center justify-between px-4 py-3 transition-colors duration-150 hover:bg-muted/50 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.businessName}</p>
                    <p className="text-xs text-muted-foreground">{t.ownerEmail}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        days <= 7 ? "text-destructive" : "text-amber-600",
                      )}
                    >
                      {days === 0 ? "Today" : `${days}d left`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{t.expiresAt}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

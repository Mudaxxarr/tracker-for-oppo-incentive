import Link from "next/link";
import { redirect } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";
import { Building2, ChevronRight, LayoutDashboard, LogOut, Search, ShieldCheck } from "lucide-react";

import { lockAction } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAuthenticated } from "@/lib/auth";
import { listTenants } from "@/lib/admin/dealers";
import { cn } from "@/lib/utils";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "grace") return "secondary";
  if (status === "expired" || status === "suspended") return "destructive";
  return "outline";
}

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isAuthenticated())) {
    redirect(`/login?next=${encodeURIComponent("/manager")}`);
  }

  const [{ q }, tenants] = await Promise.all([searchParams, listTenants()]);
  const query = q?.trim().toLowerCase() ?? "";
  const visible = query
    ? tenants.filter((tenant) =>
        `${tenant.businessName} ${tenant.ownerEmail}`.toLowerCase().includes(query),
      )
    : tenants;

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">Incento Manager</h1>
            <p className="text-xs text-muted-foreground">Owner-only dealer controls</p>
          </div>
          <form action={lockAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3.5 shadow-sm transition-colors hover:bg-primary/10"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <LayoutDashboard className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">My Own Dealer Data</p>
            <p className="text-xs text-muted-foreground">Add purchases &amp; activations, view your own dashboard</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Dealer accounts</p>
              <p className="text-xs text-muted-foreground">
                Open any dealer as admin, review policy settings, or change feature access.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">{tenants.length}</Badge>
          </div>

          <form className="relative mt-4" action="/manager">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search business or admin login…"
              className="h-11 pl-9"
            />
          </form>
        </section>

        <section className="space-y-2.5">
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card px-5 py-10 text-center">
              <Building2 className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="text-sm font-medium">No matching dealer</p>
              <p className="text-xs text-muted-foreground">Try a business name or admin login ID.</p>
            </div>
          ) : (
            visible.map((tenant) => {
              const days = differenceInDays(parseISO(tenant.expiresAt), new Date());
              return (
                <Link
                  key={tenant.id}
                  href={`/manager/${tenant.id}`}
                  className="flex min-h-20 items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 shadow-sm transition-colors hover:bg-muted/50"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{tenant.businessName}</p>
                      <Badge variant={statusVariant(tenant.status)}>{tenant.status}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{tenant.ownerEmail}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {tenant.userCount} login{tenant.userCount === 1 ? "" : "s"} · {days >= 0 ? `${days} days left` : `expired ${Math.abs(days)} days ago`}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })
          )}
        </section>

        <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Open full admin console
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { listTenants } from "@/lib/admin/dealers";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";
import { Plus } from "lucide-react";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "grace") return "secondary";
  if (status === "expired" || status === "suspended") return "destructive";
  return "outline";
}

function daysRemaining(expiresAt: string): number {
  return differenceInDays(parseISO(expiresAt), new Date());
}

export default async function AdminDealersPage() {
  const tenants = await listTenants();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dealers</h1>
        <Link href="/admin/dealers/new" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="mr-1 size-4" />
          New Dealer
        </Link>
      </div>

      {tenants.length === 0 && (
        <p className="text-sm text-muted-foreground">No dealer accounts yet.</p>
      )}

      <div className="space-y-2">
        {tenants.map((t) => {
          const days = daysRemaining(t.expiresAt);
          return (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{t.businessName}</p>
                  <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.ownerEmail} &middot; {t.userCount} user{t.userCount !== 1 ? "s" : ""} &middot;{" "}
                  {days > 0 ? `${days} days left` : `expired ${Math.abs(days)} days ago`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href={`/admin/dealers/${t.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>View</Link>
                <Link href={`/admin/dealers/${t.id}/renew`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Renew</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

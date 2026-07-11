import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { db, schema } from "@/lib/db/client";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO, format } from "date-fns";

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "grace") return "secondary";
  return "destructive";
}

export default async function DealerBillingPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  if (session.role === "exec") redirect("/dealer/dashboard");

  const [tenantRows, events] = await Promise.all([
    db
      .select({
        status: schema.dealerTenants.status,
        expiresAt: schema.dealerTenants.expiresAt,
        planMonths: schema.dealerTenants.planMonths,
        monthlyFee: schema.dealerTenants.monthlyFee,
        businessName: schema.dealerTenants.businessName,
      })
      .from(schema.dealerTenants)
      .where(eq(schema.dealerTenants.id, session.tenantId))
      .limit(1),
    db
      .select({
        id: schema.billingEvents.id,
        amount: schema.billingEvents.amount,
        paidAt: schema.billingEvents.paidAt,
        note: schema.billingEvents.note,
        monthsAdded: schema.billingEvents.monthsAdded,
        createdAt: schema.billingEvents.createdAt,
      })
      .from(schema.billingEvents)
      .where(eq(schema.billingEvents.tenantId, session.tenantId))
      .orderBy(desc(schema.billingEvents.createdAt)),
  ]);

  const tenant = tenantRows[0];
  if (!tenant) redirect("/dealer/login");

  const days = differenceInDays(parseISO(tenant.expiresAt), new Date());

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Subscription</h1>

      {/* Plan card */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(tenant.status)}>{tenant.status}</Badge>
          <span className="text-sm text-muted-foreground">
            {days > 0 ? `${days} days remaining` : `expired ${Math.abs(days)} days ago`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Expiry</p>
            <p className="font-medium">{format(parseISO(tenant.expiresAt), "d MMM yyyy")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="font-medium">{tenant.planMonths} month{tenant.planMonths !== 1 ? "s" : ""}</p>
          </div>
          {tenant.monthlyFee != null && (
            <div>
              <p className="text-xs text-muted-foreground">Monthly fee</p>
              <p className="font-medium">PKR {tenant.monthlyFee.toLocaleString()}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          To renew or for billing questions, contact your administrator.
        </p>
      </div>

      {/* Payment history */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Payment History</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments on record.</p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    PKR {e.amount.toLocaleString()}
                    {e.monthsAdded ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        +{e.monthsAdded}m
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(e.paidAt), "d MMM yyyy")}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

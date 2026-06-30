import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listAllTenantTrials } from "@/lib/admin/dealers";
import { listAllOwnerAlerts } from "@/lib/db/queries/alerts";
import { PREVIEW_CATALOG, BADGE_LABEL, BADGE_COLOR } from "@/lib/dealer-previews";
import { getTrialStatus } from "@/lib/dealer-trials";
import { cn } from "@/lib/utils";
import { broadcastAction, approvePurchaseAction } from "./actions";
import { Sparkles, Users, CheckCircle2, ShoppingBag, Send, XCircle } from "lucide-react";

export const metadata = { title: "Feature Trials" };

export default async function AdminPreviewsPage() {
  if (!(await isAuthenticated())) redirect("/login");

  const [tenants, allAlerts] = await Promise.all([
    listAllTenantTrials(),
    listAllOwnerAlerts(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const totalActive = tenants.filter((t) => t.featureTrials && Object.keys(t.featureTrials).length > 0);

  // Purchase requests = unread alerts of type addon_purchase_request
  const purchaseRequests = allAlerts.filter(
    (a) => a.type === "addon_purchase_request" && !a.isRead,
  );

  // Stats per feature key
  function stats(key: string) {
    let trialing = 0, purchased = 0;
    for (const t of tenants) {
      const s = getTrialStatus(t.featureTrials, key as never, today);
      if (s === "active") trialing++;
      if (s === "purchased") purchased++;
    }
    return { trialing, purchased };
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Feature Trials</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a feature and send a free trial to all your dealers. They can try it, then request to purchase as a monthly add-on.
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {tenants.length} active dealers
        </div>
      </div>

      {/* Purchase Requests */}
      {purchaseRequests.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {purchaseRequests.length}
            </span>
            <h2 className="text-sm font-semibold">Purchase Requests</h2>
          </div>
          <div className="space-y-2">
            {purchaseRequests.map((req) => {
              let parsed: { key?: string; label?: string; monthlyPrice?: number | null } = {};
              try { parsed = JSON.parse(req.payload ?? "{}"); } catch { /* ignore */ }
              return (
                <div key={req.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 gap-3">
                  <div>
                    <p className="text-sm font-medium">{req.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {tenants.find((t) => t.id === req.tenantId)?.businessName ?? req.tenantId}
                      {parsed.monthlyPrice ? ` · Rs ${parsed.monthlyPrice}/mo` : ""}
                    </p>
                  </div>
                  <form action={approvePurchaseAction} className="shrink-0">
                    <input type="hidden" name="tenantId" value={req.tenantId} />
                    <input type="hidden" name="key" value={parsed.key ?? ""} />
                    <input type="hidden" name="alertId" value={req.id} />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Approve & Activate
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Feature cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Send Trials to All Dealers</h2>
        <div className="space-y-3">
          {PREVIEW_CATALOG.map((preview) => {
            const { trialing, purchased } = stats(preview.key);
            const anyActive = trialing > 0;
            return (
              <div key={preview.key} className={cn(
                "rounded-xl border bg-card p-4 space-y-3",
                anyActive && "border-primary/20 bg-primary/5"
              )}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_COLOR[preview.badge])}>
                        {BADGE_LABEL[preview.badge]}
                      </span>
                      {anyActive && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                          Live trial
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold">{preview.label}</p>
                    <p className="text-xs text-muted-foreground">{preview.tagline}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {preview.monthlyPrice ? `Rs ${preview.monthlyPrice}/mo` : "Free"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{preview.trialDays}d free trial</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2.5">
                  <span className="flex items-center gap-1">
                    <Users className="size-3" />
                    {trialing > 0 ? <span className="font-medium text-primary">{trialing} trialing</span> : "0 trialing"}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="size-3" />
                    {purchased > 0 ? <span className="font-medium text-foreground">{purchased} purchased</span> : "0 purchased"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <form action={broadcastAction}>
                    <input type="hidden" name="key" value={preview.key} />
                    <input type="hidden" name="action" value="grant" />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      <Send className="size-3.5" />
                      {anyActive ? `Re-send ${preview.trialDays}d Trial` : `Send ${preview.trialDays}d Trial to All`}
                    </button>
                  </form>
                  {anyActive && (
                    <form action={broadcastAction}>
                      <input type="hidden" name="key" value={preview.key} />
                      <input type="hidden" name="action" value="revoke" />
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                      >
                        <XCircle className="size-3.5" />
                        End Trial
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

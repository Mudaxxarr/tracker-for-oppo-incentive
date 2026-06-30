import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantTrialsById } from "@/lib/admin/dealers";
import { PREVIEW_CATALOG, BADGE_LABEL, BADGE_COLOR } from "@/lib/dealer-previews";
import { getTrialStatus, daysLeft } from "@/lib/dealer-trials";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Sparkles, Lock, ShoppingBag } from "lucide-react";
import { requestPurchaseAction } from "./actions";

export default async function WhatsNewPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const trials = await getTenantTrialsById(session.tenantId);
  const today = new Date().toISOString().slice(0, 10);

  const active = PREVIEW_CATALOG.filter((p) => getTrialStatus(trials, p.key, today) === "active");
  const purchased = PREVIEW_CATALOG.filter((p) => getTrialStatus(trials, p.key, today) === "purchased");
  const expired = PREVIEW_CATALOG.filter((p) => getTrialStatus(trials, p.key, today) === "expired");
  const available = PREVIEW_CATALOG.filter((p) => getTrialStatus(trials, p.key, today) === "none");

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">What&apos;s New</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          New features and add-ons available for your account. Contact your administrator to activate a trial or purchase.
        </p>
      </div>

      {/* Active Trials */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">Active Trials</h2>
          <div className="space-y-3">
            {active.map((preview) => {
              const entry = trials[preview.key]!;
              const left = daysLeft(entry.trialUntil, today);
              return (
                <div key={preview.key} className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_COLOR[preview.badge])}>
                          {BADGE_LABEL[preview.badge]}
                        </span>
                      </div>
                      <p className="text-sm font-semibold">{preview.label}</p>
                      <p className="text-xs text-muted-foreground">{preview.tagline}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      <Clock className="size-3" />
                      {left}d left
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {preview.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="size-1 rounded-full bg-primary/40 shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-primary font-medium">
                      Active — explore it from the sidebar.
                    </p>
                    <form action={requestPurchaseAction}>
                      <input type="hidden" name="key" value={preview.key} />
                      <button type="submit" className="flex items-center gap-1 rounded-md border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        <ShoppingBag className="size-3" />
                        Buy Add-on
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Purchased */}
      {purchased.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purchased Add-ons</h2>
          <div className="space-y-2">
            {purchased.map((preview) => (
              <div key={preview.key} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{preview.label}</p>
                  <p className="text-xs text-muted-foreground">{preview.tagline}</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  <CheckCircle2 className="size-3" />
                  Active
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Expired Trials */}
      {expired.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trial Ended</h2>
          <div className="space-y-2">
            {expired.map((preview) => (
              <div key={preview.key} className="rounded-xl border bg-card p-4 space-y-2 opacity-70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_COLOR[preview.badge])}>
                      {BADGE_LABEL[preview.badge]}
                    </span>
                    <p className="text-sm font-semibold mt-1">{preview.label}</p>
                    <p className="text-xs text-muted-foreground">{preview.tagline}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground shrink-0">
                    Trial ended
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    {preview.monthlyPrice ? `Rs ${preview.monthlyPrice}/mo` : "Included in plan"}
                  </p>
                  <form action={requestPurchaseAction}>
                    <input type="hidden" name="key" value={preview.key} />
                    <button type="submit" className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                      <ShoppingBag className="size-3" />
                      Request Purchase
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available Features */}
      {available.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Available Features</h2>
          <div className="space-y-3">
            {available.map((preview) => (
              <div key={preview.key} className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_COLOR[preview.badge])}>
                      {BADGE_LABEL[preview.badge]}
                    </span>
                    <p className="text-sm font-semibold mt-1">{preview.label}</p>
                    <p className="text-xs text-muted-foreground">{preview.tagline}</p>
                  </div>
                  <Lock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
                <ul className="space-y-0.5">
                  {preview.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1 rounded-full bg-muted-foreground/30 shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  {preview.monthlyPrice ? `Rs ${preview.monthlyPrice}/mo` : "Included in plan"} · Ask your admin to grant a free trial.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

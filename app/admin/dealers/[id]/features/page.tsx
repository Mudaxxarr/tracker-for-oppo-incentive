import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantById, getTenantTrialsById } from "@/lib/admin/dealers";
import {
  FEATURE_REGISTRY, isNodeOn, BADGE_LABEL, BADGE_COLOR,
  type FeatureNode,
} from "@/lib/feature-registry";
import type { DealerFeatures } from "@/lib/dealer-features";
import { getTrialStatus, daysLeft, type FeatureTrials } from "@/lib/dealer-trials";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  saveFeaturesAction, enableAllFeaturesAction,
  grantTrialAction, revokeTrialAction, markPurchasedAction,
} from "./actions";
import { Sparkles, CheckCircle2, Clock, ShoppingBag, CornerDownRight } from "lucide-react";

const FORM_ID = "feature-toggles";

interface Props { params: Promise<{ id: string }> }

export default async function DealerFeaturesPage({ params }: Props) {
  const { id } = await params;
  const [tenant, trials] = await Promise.all([getTenantById(id), getTenantTrialsById(id)]);
  if (!tenant) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const features = tenant.features; // raw stored flags

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Feature Access — {tenant.businessName}</h1>
          <p className="text-sm text-muted-foreground">
            Toggle each tab and the sub-features inside it, or grant a free trial. Toggles save together; trials apply instantly.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <form action={enableAllFeaturesAction}>
            <input type="hidden" name="tenantId" value={id} />
            <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Enable All</button>
          </form>
          <Link href={`/admin/dealers/${id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Back</Link>
        </div>
      </div>

      {/* Hidden save-form: checkboxes below bind to it via form={FORM_ID} */}
      <form id={FORM_ID} action={saveFeaturesAction}>
        <input type="hidden" name="tenantId" value={id} />
      </form>

      {/* Groups */}
      <div className="space-y-4">
        {FEATURE_REGISTRY.map((group) => (
          <div key={group.tab} className="rounded-xl border bg-card overflow-hidden">
            {/* Tab row */}
            <NodeRow node={group} tenantId={id} features={features} trials={trials} today={today} isTab />
            {/* Children */}
            {group.children.length > 0 && (
              <div className="divide-y border-t bg-muted/20">
                {group.children.map((child) => (
                  <NodeRow key={child.key} node={child} tenantId={id} features={features} trials={trials} today={today} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-background/95 py-3 backdrop-blur">
        <p className="text-xs text-muted-foreground">Toggle changes are saved on click of Save.</p>
        <button type="submit" form={FORM_ID} className={cn(buttonVariants({ size: "sm" }))}>Save changes</button>
      </div>
    </div>
  );
}

function NodeRow({
  node, tenantId, features, trials, today, isTab = false,
}: {
  node: FeatureNode;
  tenantId: string;
  features: DealerFeatures;
  trials: FeatureTrials;
  today: string;
  isTab?: boolean;
}) {
  const on = isNodeOn(features, node);
  const status = getTrialStatus(trials, node.key as never, today);
  const entry = trials[node.key as never] as { trialUntil: string } | undefined;

  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-3", !isTab && "pl-9")}>
      {/* Left: label + meta */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {!isTab && <CornerDownRight className="size-3.5 text-muted-foreground shrink-0" />}
          {node.badge && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_COLOR[node.badge])}>
              {BADGE_LABEL[node.badge]}
            </span>
          )}
          <span className={cn("font-medium truncate", isTab ? "text-sm" : "text-[13px]")}>{node.label}</span>
          {status === "active" && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Clock className="size-3" />{entry ? daysLeft(entry.trialUntil, today) : 0}d trial
            </span>
          )}
          {status === "purchased" && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <CheckCircle2 className="size-3" />Purchased
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {node.hint ? node.hint : null}
          {node.monthlyPrice ? `${node.hint ? " · " : ""}Rs ${node.monthlyPrice}/mo` : null}
        </p>
      </div>

      {/* Right: trial buttons + toggle */}
      <div className="flex items-center gap-1.5 shrink-0">
        {status !== "purchased" && (
          <form action={grantTrialAction}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="key" value={node.key} />
            <button type="submit" className={cn(buttonVariants({ size: "sm", variant: status === "active" ? "outline" : "ghost" }), "h-7 gap-1 text-[11px]")}>
              <Sparkles className="size-3" />
              {status === "active" ? "Extend" : status === "expired" ? "Re-grant" : `${node.trialDays}d trial`}
            </button>
          </form>
        )}
        {status === "active" && (
          <form action={revokeTrialAction}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="key" value={node.key} />
            <button type="submit" className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 text-[11px] text-muted-foreground")}>End</button>
          </form>
        )}
        {(status === "active" || status === "expired") && node.monthlyPrice != null && (
          <form action={markPurchasedAction}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="key" value={node.key} />
            <button type="submit" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-7 gap-1 text-[11px]")}>
              <ShoppingBag className="size-3" />Purchased
            </button>
          </form>
        )}

        {/* Toggle (binds to the hidden save form) */}
        <label className="flex items-center gap-1.5 cursor-pointer pl-1">
          <span className={cn("text-[11px] font-medium w-7 text-right", on ? "text-primary" : "text-muted-foreground")}>
            {on ? "ON" : "OFF"}
          </span>
          <input form={FORM_ID} type="checkbox" name={node.key} defaultChecked={on} className="size-4 accent-primary" />
        </label>
      </div>
    </div>
  );
}

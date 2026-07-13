import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Settings2,
  SlidersHorizontal,
  UserRoundCog,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import {
  getDealerSettings,
  getRawTenantFeatures,
  getTenantById,
} from "@/lib/admin/dealers";
import {
  BADGE_COLOR,
  BADGE_LABEL,
  FEATURE_REGISTRY,
  isNodeOn,
} from "@/lib/feature-registry";
import { cn } from "@/lib/utils";
import {
  enableAllManagerFeaturesAction,
  saveManagerFeaturesAction,
  saveManagerSettingsAction,
} from "../actions";

export default async function ManagerDealerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  if (!(await isAuthenticated())) {
    redirect(`/login?next=${encodeURIComponent(`/manager/${id}`)}`);
  }

  const [{ saved, error }, tenant, settings, features] = await Promise.all([
    searchParams,
    getTenantById(id),
    getDealerSettings(id),
    getRawTenantFeatures(id),
  ]);
  if (!tenant || !settings) notFound();

  const returnTo = `/manager/${id}`;
  const impersonateHref = `/api/admin/impersonate/${id}?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="min-h-screen bg-muted/30 pb-10">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-3 py-3">
          <Link
            href="/manager"
            aria-label="Back to dealers"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{tenant.businessName}</h1>
            <p className="truncate text-xs text-muted-foreground">{tenant.ownerEmail}</p>
          </div>
          <Badge>{tenant.status}</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {(saved || error) && (
          <div className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
            error
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
          )}>
            <CheckCircle2 className="size-4 shrink-0" />
            {error ?? `${saved === "settings" ? "Settings" : "Features"} saved successfully.`}
          </div>
        )}

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserRoundCog className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Access dealer admin</p>
              <p className="text-xs text-muted-foreground">
                Opens this account with its active dealer IDs and current feature restrictions.
              </p>
            </div>
          </div>
          <a href={impersonateHref} className={cn(buttonVariants(), "mt-4 h-10 w-full gap-2")}>
            <ExternalLink className="size-4" />
            Enter as dealer admin
          </a>
          <div className="mt-3 space-y-1.5 border-t pt-3">
            {tenant.users.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-muted-foreground">{user.email}</span>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}{user.isActive ? "" : " · inactive"}
                </Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <Settings2 className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Policy settings</h2>
              <p className="text-xs text-muted-foreground">Activation backdating and purchase review limits.</p>
            </div>
          </div>
          <form action={saveManagerSettingsAction} className="space-y-4">
            <input type="hidden" name="tenantId" value={id} />
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Activation backdate days</span>
              <input
                name="backdateDays"
                type="number"
                min={0}
                max={30}
                defaultValue={settings.backdateDays}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Purchase approval threshold (PKR)</span>
              <input
                name="purchaseApprovalThreshold"
                type="number"
                min={0}
                defaultValue={settings.purchaseApprovalThreshold ?? ""}
                placeholder="Blank = disabled"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <button type="submit" className={cn(buttonVariants(), "h-10 w-full")}>Save policy settings</button>
          </form>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <SlidersHorizontal className="mt-0.5 size-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Feature access</h2>
                <p className="text-xs text-muted-foreground">Enable or disable dealer tabs and add-ons.</p>
              </div>
            </div>
            <form action={enableAllManagerFeaturesAction}>
              <input type="hidden" name="tenantId" value={id} />
              <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Enable all
              </button>
            </form>
          </div>

          <form action={saveManagerFeaturesAction} className="mt-4 space-y-3">
            <input type="hidden" name="tenantId" value={id} />
            {FEATURE_REGISTRY.map((group) => (
              <div key={group.key} className="overflow-hidden rounded-xl border">
                <FeatureToggle name={group.key} label={group.label} checked={isNodeOn(features, group)} badge={group.badge} />
                {group.children.length > 0 && (
                  <div className="divide-y border-t bg-muted/20 pl-4">
                    {group.children.map((child) => (
                      <FeatureToggle
                        key={child.key}
                        name={child.key}
                        label={child.label}
                        hint={child.hint}
                        checked={isNodeOn(features, child)}
                        badge={child.badge}
                        child
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="sticky bottom-3 pt-1">
              <button type="submit" className={cn(buttonVariants(), "h-11 w-full shadow-lg")}>
                Save feature access
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function FeatureToggle({
  name,
  label,
  hint,
  checked,
  badge,
  child = false,
}: {
  name: string;
  label: string;
  hint?: string;
  checked: boolean;
  badge?: keyof typeof BADGE_LABEL;
  child?: boolean;
}) {
  return (
    <label className={cn("flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2.5", child && "pl-2")}>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{label}</span>
          {badge && (
            <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", BADGE_COLOR[badge])}>
              {BADGE_LABEL[badge]}
            </span>
          )}
        </span>
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{hint}</span>}
      </span>
      <input name={name} type="checkbox" defaultChecked={checked} className="peer sr-only" />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-muted-foreground/25 transition-colors after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2" />
    </label>
  );
}

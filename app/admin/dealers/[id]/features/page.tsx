import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantById } from "@/lib/admin/dealers";
import {
  ALL_FEATURE_KEYS,
  DEALER_FEATURE_LABELS,
  isFeatureEnabled,
} from "@/lib/dealer-features";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveFeaturesAction, enableAllFeaturesAction } from "./actions";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DealerFeaturesPage({ params }: Props) {
  const { id } = await params;
  const tenant = await getTenantById(id);
  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Feature Access — {tenant.businessName}</h1>
          <p className="text-sm text-muted-foreground">
            Grant or revoke access to each module. New dealers start with everything off — you must explicitly enable what they have paid for.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={enableAllFeaturesAction}>
            <input type="hidden" name="tenantId" value={id} />
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Enable All
            </button>
          </form>
          <Link
            href={`/admin/dealers/${id}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Back
          </Link>
        </div>
      </div>

      <form action={saveFeaturesAction} className="max-w-sm space-y-3">
        <input type="hidden" name="tenantId" value={id} />

        {ALL_FEATURE_KEYS.map((key) => {
          const enabled = isFeatureEnabled(tenant.features, key);
          return (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <span className="text-sm font-medium">{DEALER_FEATURE_LABELS[key]}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${enabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  {enabled ? "ON" : "OFF"}
                </span>
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={enabled}
                  className="size-4 accent-primary"
                />
              </div>
            </label>
          );
        })}

        <button type="submit" className={cn(buttonVariants({ size: "sm" }))}>
          Save changes
        </button>
      </form>
    </div>
  );
}

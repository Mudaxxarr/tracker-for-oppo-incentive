import { notFound } from "next/navigation";
import Link from "next/link";
import { getDealerSettings } from "@/lib/admin/dealers";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveDealerSettingsAction } from "./actions";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function DealerSettingsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error } = await searchParams;
  const settings = await getDealerSettings(id);
  if (!settings) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Policy Settings</h1>
          <p className="text-sm text-muted-foreground">
            Controls that govern this dealer's activation and purchase behaviour.
          </p>
        </div>
        <Link href={`/admin/dealers/${id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Back
        </Link>
      </div>

      <form action={saveDealerSettingsAction} className="max-w-sm space-y-4">
        <input type="hidden" name="tenantId" value={id} />

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Activation Backdate Window</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              How many days back a dealer can date an activation. 0 = today only. Max 30.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="backdateDays">Days allowed</label>
            <input
              id="backdateDays"
              name="backdateDays"
              type="number"
              min={0}
              max={30}
              defaultValue={settings.backdateDays}
              className="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Purchase Approval Threshold</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Purchases above this amount (PKR) are held for owner review.
              Leave blank to disable — all purchases auto-approved.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="purchaseApprovalThreshold">Threshold (PKR)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">PKR</span>
              <input
                id="purchaseApprovalThreshold"
                name="purchaseApprovalThreshold"
                type="number"
                min={0}
                defaultValue={settings.purchaseApprovalThreshold ?? ""}
                placeholder="Disabled"
                className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Save settings
        </button>
      </form>
    </div>
  );
}

import { Lock } from "lucide-react";

export function FeatureDisabled() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card p-12 text-center">
      <Lock className="size-8 text-muted-foreground/50" />
      <div>
        <p className="font-medium">Feature not available</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This module is not included in your current plan. Contact your administrator to enable it.
        </p>
      </div>
    </div>
  );
}

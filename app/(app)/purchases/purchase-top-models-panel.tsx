import { Package } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { TopModel } from "@/lib/purchases/purchase-stats";

export function PurchaseTopModelsPanel({ models }: { models: TopModel[] }) {
  if (models.length === 0) {
    return <EmptyState icon={Package} title="No models purchased in this range." description="Add a purchase to see it ranked here." className="py-8" />;
  }
  const max = models[0].qty;
  return (
    <div className="space-y-3">
      {models.map((m, i) => {
        const pct = max > 0 ? Math.round((m.qty / max) * 100) : 0;
        return (
          <div key={m.modelId} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-xs text-muted-foreground/60">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{m.modelName}</p>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="shrink-0 font-mono text-sm tabular-nums">{m.qty}</span>
          </div>
        );
      })}
    </div>
  );
}

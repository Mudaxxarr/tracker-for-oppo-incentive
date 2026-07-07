import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  deltaPercent?: number | null;
  deltaLabel?: string;
  danger?: boolean;
}

export function PurchaseKpiCard({ icon: Icon, label, value, deltaPercent, deltaLabel, danger = false }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-semibold tabular-nums", danger && "text-destructive")}>{value}</p>
        {deltaPercent != null && (
          <p className={cn("mt-0.5 inline-flex items-center gap-1 text-xs tabular-nums", deltaPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            {deltaPercent >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(deltaPercent)}%{deltaLabel ? ` ${deltaLabel}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

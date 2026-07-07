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
    <div className="flex min-w-0 items-start gap-2 overflow-hidden rounded-xl border border-border bg-card p-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className={cn("truncate text-sm font-semibold tabular-nums", danger && "text-destructive")} title={value}>{value}</p>
        {deltaPercent != null && (
          <p className={cn("mt-0.5 inline-flex items-center gap-1 truncate text-[11px] tabular-nums", deltaPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            {deltaPercent >= 0 ? <TrendingUp className="size-3 shrink-0" /> : <TrendingDown className="size-3 shrink-0" />}
            <span className="truncate">{Math.abs(deltaPercent)}%{deltaLabel ? ` ${deltaLabel}` : ""}</span>
          </p>
        )}
      </div>
    </div>
  );
}

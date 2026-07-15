"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Package, Smartphone, Tag, Trophy, Target, TrendingUp } from "lucide-react";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DealerHeroCardProps {
  periodLabel: string;
  totalReceivable: number;
  totalReceivableGrowthPercent: number | null;
  periodPurchaseUnits: number;
  periodActivations: number;
  periodNetSalesValue: number;
  rebateEarned: number;
  topSelling?: { modelName: string; qty: number };
  targetPct: number;
  hasTarget: boolean;
  last7DaysTrend: Array<{ label: string; netSales: number }>;
}

const compactPKR = (n: number) => {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${sign}Rs ${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  if (v >= 1_000) return `${sign}Rs ${(v / 1_000).toFixed(1)}K`;
  return `${sign}Rs ${v}`;
};

/** Mobile-only summary card — sits above the full dashboard on small screens.
 *  Deliberately restrained: flat surface, no ambient color, no decoration —
 *  matches the same card/typography conventions as the rest of the dashboard. */
export function DealerHeroCard({
  periodLabel,
  totalReceivable,
  totalReceivableGrowthPercent,
  periodPurchaseUnits,
  periodActivations,
  periodNetSalesValue,
  rebateEarned,
  topSelling,
  targetPct,
  hasTarget,
  last7DaysTrend,
}: DealerHeroCardProps) {
  const growthUp = (totalReceivableGrowthPercent ?? 0) >= 0;

  return (
    <div className="dashboard-card-live overflow-hidden rounded-xl border border-border bg-card shadow-none lg:hidden">
      {/* Headline */}
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total Receivable</p>
          <p className="mt-1 font-mono text-[1.65rem] font-normal leading-tight tabular-nums text-foreground">
            {compactPKR(totalReceivable)}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
            {totalReceivableGrowthPercent != null && (
              <span className={cn("text-xs font-medium", growthUp ? "text-primary" : "text-destructive")}>
                {growthUp ? "▲" : "▼"} {Math.abs(totalReceivableGrowthPercent)}%
              </span>
            )}
          </div>
        </div>
        <TrendingUp className="mt-0.5 size-5 shrink-0 text-primary" />
      </div>

      {/* Stat tile grid */}
      <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
        <HeroTile icon={Package} label="Purchase Qty" value={String(periodPurchaseUnits)} sub="Units" />
        <HeroTile icon={Smartphone} label="Activations" value={String(periodActivations)} sub="Units" />
        <HeroTile icon={Tag} label="Net Sales" value={compactPKR(periodNetSalesValue)} sub="This period" />
        <HeroTile icon={Tag} label="Price-Drop Refund" value={compactPKR(rebateEarned)} sub="Dealer price change" />
        <HeroTile
          icon={Trophy}
          label="Top-Selling Model"
          value={topSelling ? topSelling.modelName : "—"}
          sub={topSelling ? `${topSelling.qty} sold` : undefined}
        />
        <div className="flex min-h-[92px] flex-col justify-center gap-1.5 bg-card px-4 py-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Target className="size-3.5" />
            <span className="text-xs">Target Progress</span>
          </div>
          <p className="font-mono text-sm font-normal tabular-nums text-foreground">
            {hasTarget ? `${Math.round(targetPct)}%` : "No target"}
          </p>
          <div
            role="progressbar"
            aria-label="Target progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(targetPct)}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${hasTarget ? Math.max(2, targetPct) : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* 7-day net sales trend — green here means "the dealer's own confirmed sales" */}
      <div className="border-t border-border px-5 py-4">
        <p className="text-xs font-medium text-muted-foreground">Sales trend (last 7 days)</p>
        <div className="mt-2 h-28">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={50}>
            <LineChart data={last7DaysTrend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                className="text-[10px]"
              />
              <Tooltip
                formatter={(v) => [formatPKR(Number(v)), "Net sales"]}
                labelClassName="text-xs"
                contentStyle={{
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="netSales"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function HeroTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex min-h-[92px] flex-col justify-center gap-1 bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="truncate font-mono text-sm font-normal tabular-nums text-foreground" title={value}>
        {value}
      </p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

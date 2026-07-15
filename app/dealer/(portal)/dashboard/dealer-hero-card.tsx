"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Package, Smartphone, Tag, Trophy, Target } from "lucide-react";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HeroTileProps {
  icon: typeof Package;
  label: string;
  value: string;
  sub?: string;
}

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

/** Mobile-only retail-overview hero — sits above the full dashboard on small screens. */
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
    <div className="dashboard-card-live overflow-hidden rounded-2xl border border-border bg-card shadow-none lg:hidden">
      {/* Headline section */}
      <div className="relative overflow-hidden px-5 pb-8 pt-5">
        <div className="relative z-10">
          <p className="text-sm font-semibold tracking-tight text-primary">oppo</p>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Retail overview
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Total Receivable</p>
          <p className="mt-1 font-mono text-4xl font-semibold leading-none tabular-nums text-foreground">
            {compactPKR(totalReceivable)}
          </p>
          {totalReceivableGrowthPercent != null && (
            <div
              className={cn(
                "mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                growthUp ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
              )}
            >
              <span>{growthUp ? "▲" : "▼"}</span>
              <span>{Math.abs(totalReceivableGrowthPercent)}% vs last period</span>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{periodLabel}</p>
        </div>

        {/* Decorative abstract graphic — original gradient shapes, no third-party asset */}
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <div
            className="absolute -bottom-16 -left-10 size-56 rounded-full opacity-[0.14] blur-2xl"
            style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-24 left-16 size-64 rounded-full opacity-[0.10] blur-2xl"
            style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
          />
        </div>
      </div>

      {/* Stat tile grid */}
      <div className="grid grid-cols-2 gap-px bg-border">
        <HeroTile icon={Package} label="Purchase Qty" value={String(periodPurchaseUnits)} sub="Units" />
        <HeroTile icon={Smartphone} label="Activations" value={String(periodActivations)} sub="Units" />
        <HeroTile icon={Tag} label="Net Sales" value={compactPKR(periodNetSalesValue)} sub="This period" />
        <HeroTile
          icon={Tag}
          label="Price-Drop Refund"
          value={compactPKR(rebateEarned)}
          sub="Dealer price change"
        />
        <div className="flex min-h-[92px] flex-col justify-center gap-1 bg-card px-4 py-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Trophy className="size-3.5" />
            <span className="text-xs">Top-Selling Model</span>
          </div>
          <p className="truncate text-sm font-semibold text-foreground">
            {topSelling ? topSelling.modelName : "—"}
          </p>
          {topSelling && <p className="text-xs text-muted-foreground">{topSelling.qty} sold</p>}
        </div>
        <div className="flex min-h-[92px] flex-col justify-center gap-1.5 bg-card px-4 py-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Target className="size-3.5" />
            <span className="text-xs">Target Progress</span>
          </div>
          <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
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

      {/* 7-day net sales trend */}
      <div className="border-t border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Sales Trend (Last 7 Days)</p>
        </div>
        <div className="mt-2 h-32">
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
                dot={{ r: 3, fill: "var(--primary)" }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function HeroTile({ icon: Icon, label, value, sub }: HeroTileProps) {
  return (
    <div className="flex min-h-[92px] flex-col justify-center gap-1 bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-mono text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

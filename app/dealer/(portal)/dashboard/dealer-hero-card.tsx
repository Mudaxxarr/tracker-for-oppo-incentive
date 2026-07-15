"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Package, Smartphone, PieChart, Tag, Medal, Target } from "lucide-react";
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
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:hidden">
      {/* Headline panel — soft mint tint + decorative ribbon */}
      <div
        className="relative overflow-hidden px-5 pb-28 pt-6"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--primary) 6%, var(--card)) 0%, color-mix(in oklab, var(--primary) 10%, var(--card)) 100%)",
        }}
      >
        <div className="relative z-10">
          <p className="font-mono text-base font-bold tracking-tight text-primary">oppo</p>

          <div className="mt-5 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Retail overview
            </span>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">Total Receivable</p>
          <p className="mt-0.5 font-mono text-[2.5rem] font-bold leading-none tabular-nums text-foreground">
            {compactPKR(totalReceivable)}
          </p>

          {totalReceivableGrowthPercent != null && (
            <div
              className={cn(
                "mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                growthUp ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive",
              )}
            >
              <span>{growthUp ? "▲" : "▼"}</span>
              <span>{Math.abs(totalReceivableGrowthPercent)}% vs last period</span>
            </div>
          )}

          <div className="mt-4 border-t border-primary/10 pt-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {hasTarget && targetPct >= 100
                ? "Your store performance is above target this period."
                : periodLabel}
            </p>
          </div>
        </div>

        {/* Decorative abstract ribbon — original layered gradient shapes, not a copied asset.
            Confined to the bottom strip so it never crosses the text above it. */}
        <svg
          className="pointer-events-none absolute -bottom-2 -left-6 z-0 h-28 w-56 opacity-80"
          viewBox="0 0 220 110"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M-10 105C50 100 65 75 45 55C25 35 55 5 100 18C145 31 128 68 165 80C202 92 215 65 230 68"
            stroke="var(--primary)"
            strokeOpacity="0.3"
            strokeWidth="20"
            strokeLinecap="round"
          />
          <path
            d="M-10 90C45 85 60 62 42 46C24 30 55 8 95 20C135 32 118 62 150 75"
            stroke="var(--primary)"
            strokeOpacity="0.55"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M-10 72C35 68 48 48 32 34"
            stroke="var(--primary)"
            strokeOpacity="0.85"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Stat tile grid */}
      <div className="grid grid-cols-2 gap-px bg-border">
        <HeroTile icon={Package} label="Purchase Qty" value={String(periodPurchaseUnits)} sub="Units" />
        <HeroTile icon={Smartphone} label="Activations" value={String(periodActivations)} sub="Units" />
        <HeroTile icon={Tag} label="Net Sales" value={compactPKR(periodNetSalesValue)} sub="This period" />
        <HeroTile icon={PieChart} label="Price-Drop Refund" value={compactPKR(rebateEarned)} sub="Dealer price change" />

        <div className="flex min-h-[104px] items-center gap-3 bg-card px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 grid size-9 place-items-center rounded-full bg-primary/10">
              <Medal className="size-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Top-Selling Model</p>
            <p className="truncate text-sm font-semibold text-foreground">
              {topSelling ? `${topSelling.modelName} (${topSelling.qty})` : "—"}
            </p>
          </div>
          <PhoneGlyph className="h-16 w-9 shrink-0" />
        </div>

        <div className="flex min-h-[104px] flex-col justify-center gap-1.5 bg-card px-4 py-3">
          <div className="mb-1 grid size-9 place-items-center rounded-full bg-primary/10">
            <Target className="size-4 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">Target Progress</p>
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
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
        <p className="text-xs font-semibold text-muted-foreground">Sales Trend (Last 7 Days)</p>
        <div className="mt-2 h-32">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={50}>
            <AreaChart data={last7DaysTrend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="heroNetSalesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="netSales"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#heroNetSalesFill)"
                dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
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
    <div className="flex min-h-[104px] flex-col justify-center gap-1 bg-card px-4 py-3">
      <div className="mb-1 grid size-9 place-items-center rounded-full bg-primary/10">
        <Icon className="size-4 text-primary" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Simple original phone silhouette (no third-party product photo). */
function PhoneGlyph({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-[10px] border-2 border-primary/25 bg-primary/5 p-1", className)}
      aria-hidden="true"
    >
      <div className="flex h-full flex-col items-center justify-between rounded-[6px] bg-primary/10 p-1">
        <span className="mt-0.5 size-1 rounded-full bg-primary/40" />
        <span className="mb-1 h-1 w-3 rounded-full bg-primary/30" />
      </div>
    </div>
  );
}

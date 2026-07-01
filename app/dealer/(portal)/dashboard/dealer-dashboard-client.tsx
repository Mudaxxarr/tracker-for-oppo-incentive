"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { DaysRemainingAlert } from "./days-remaining-alert";
import { DealerTrendChart } from "./dealer-trend-chart";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Smartphone,
  Package,
  Boxes,
  ArrowLeftRight,
  ArrowDownToLine,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  CalendarDays,
  Wallet,
  Gauge,
  Layers,
  Target,
  Trophy,
  Clock3,
  BarChart3,
} from "lucide-react";

export interface DashboardData {
  dealerName: string | null;
  label: string;
  startStr: string;
  endStr: string;
  daysLeft: number;
  expiresAt: string;
  todayActivations: number;
  monthActivations: number;
  periodActivations: number;
  purchaseRecords: number;
  totalStock: number;
  pendingCrossRegion: number;
  pendingInbound: number;
  rebateEarned: number;
  crFines: number;
  riskExposure: number;
  periodPurchaseUnits: number;
  agedStock: { units: number; value: number; modelCount: number };
  stock: Array<{ modelId: string; modelName: string; quantity: number; dealerPrice: number | null }>;
  sixMonthTrend: Array<{ label: string; activations: number; earnings: number }>;
  report: {
    baseIncentivePercent: number;
    totalActivations: number;
    targetBonus: { eligible: boolean; targetQty: number | null; actualQty: number; bonusPercent: number };
    totals: {
      basePercentEarned: number;
      bonusPercentEarned: number;
      activationIncentiveEarned: number;
      dealerIncentiveEarned: number;
      stockInEarned: number;
      grandTotal: number;
    };
    rows: Array<{
      modelId: string;
      modelName: string;
      qtyActivated: number;
      stockInRegularQty: number;
      basePercentEarned: number;
      total: number;
      stockInEarned: number;
    }>;
  } | null;
  crLoss: { lostIncentive: number; totalUnits: number } | null;
  initialSales: Array<{ modelId: string; modelName: string; qty: number }>;
  modelsWithIncentiveIds: string[];
}

const cardSurface = "dashboard-card-live rounded-xl border border-border bg-card text-card-foreground shadow-none";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function DealerDashboardClient({ data }: { data: DashboardData }) {
  const { report } = data;
  const tb = report?.targetBonus;
  const salesSorted = [...data.initialSales].sort((a, b) => b.qty - a.qty);
  const salesTotal = salesSorted.reduce((s, r) => s + r.qty, 0);
  const stockValue = data.stock.reduce((s, item) => s + item.quantity * (item.dealerPrice ?? 0), 0);

  const grand = report?.totals.grandTotal ?? 0;
  const grossReceivable = grand + data.rebateEarned;
  const netReceivable = grossReceivable - data.crFines;
  const periodActs = data.periodActivations;
  const crUnits = data.crLoss?.totalUnits ?? 0;
  const hasTarget = tb?.targetQty != null && tb.targetQty > 0;
  const targetPct = hasTarget ? clampPercent((tb!.actualQty / tb!.targetQty!) * 100) : 0;
  const pendingTarget = hasTarget ? Math.max(0, tb!.targetQty! - tb!.actualQty) : 0;
  const salesVelocityBase = data.periodPurchaseUnits > 0 ? data.periodPurchaseUnits : salesTotal + data.totalStock;
  const salesVelocityPct = salesVelocityBase > 0 ? clampPercent(Math.round((salesTotal / salesVelocityBase) * 100)) : 0;
  const sellThroughFooter = data.periodPurchaseUnits > 0
    ? `${data.periodPurchaseUnits} purchased / ${salesTotal} sold`
    : `${salesVelocityBase} available pool / ${salesTotal} sold`;
  const agedStockPct = data.totalStock > 0 ? clampPercent(Math.round((data.agedStock.units / data.totalStock) * 100)) : 0;
  const topSelling = salesSorted[0];
  const topModels = salesSorted.slice(0, 3);

  const breakdownRows = report ? [
    { label: `Base Incentive (${report.baseIncentivePercent}%)`, value: report.totals.basePercentEarned, color: "bg-primary" },
    { label: `Target Bonus (${tb?.bonusPercent ?? 0}%)`, value: report.totals.bonusPercentEarned, color: "bg-foreground/80" },
    { label: "Stock-In Incentive", value: report.totals.stockInEarned, color: "bg-muted-foreground" },
    { label: "Activation Incentive", value: report.totals.activationIncentiveEarned, color: "bg-foreground/60" },
    { label: "Dealer Incentive", value: report.totals.dealerIncentiveEarned, color: "bg-muted-foreground/75" },
    { label: "Price-drop Rebate", value: data.rebateEarned, color: "bg-border" },
    { label: "CR / Fines / Deductions", value: -data.crFines, color: "bg-destructive" },
  ] : [];

  const kpis: KpiProps[] = [
    { icon: Wallet, label: "Net receivable", value: formatPKR(netReceivable), accent: true, sub: data.label },
    { icon: Gauge, label: "Incentive earned", value: formatPKR(grand), sub: "before rebates/fines" },
    { icon: Target, label: "Target gap", value: hasTarget ? String(pendingTarget) : "No target", sub: hasTarget ? `${Math.round(targetPct)}% achieved` : `${periodActs} activations` },
    { icon: data.riskExposure > 0 ? ShieldAlert : ShieldCheck, label: "CR exposure", value: formatPKR(data.riskExposure), danger: data.riskExposure > 0, sub: data.riskExposure > 0 ? `${crUnits} CR units flagged` : "No CR risk" },
    { icon: Layers, label: "Stock value on hand", value: formatPKR(stockValue), sub: `${data.totalStock} units / ${data.stock.length} models` },
    { icon: Clock3, label: "Aged stock", value: formatPKR(data.agedStock.value), sub: `${data.agedStock.units} units / ${data.agedStock.modelCount} models` },
    { icon: BarChart3, label: "Sell-through", value: `${salesVelocityPct}%`, sub: sellThroughFooter },
    { icon: Smartphone, label: "Today activations", value: String(data.todayActivations), sub: "logged today" },
  ];

  return (
    <div className="dashboard-ambient mx-auto w-full max-w-none space-y-4 px-0 lg:max-w-[1180px] xl:max-w-[1440px] 2xl:max-w-[1520px] xl:space-y-3">
      <div className="grid gap-3 lg:grid-cols-12 lg:items-stretch">
        <PeriodPicker
          startStr={data.startStr}
          endStr={data.endStr}
          label={data.label}
          className="lg:col-span-8 xl:col-span-9"
        />
        <QuickActions
          pendingCrossRegion={data.pendingCrossRegion}
          pendingInbound={data.pendingInbound}
          className="lg:col-span-4 xl:col-span-3"
        />
      </div>

      <DaysRemainingAlert daysLeft={data.daysLeft} expiresAt={data.expiresAt} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-stretch">
        <div className={cn(cardSurface, "flex flex-col p-5 xl:col-span-5 xl:min-h-[276px]")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-normal text-muted-foreground">Net receivable</p>
              <p className="mt-1 font-mono text-[1.65rem] font-normal leading-tight tabular-nums text-primary">{formatPKR(netReceivable)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{data.label}</p>
            </div>
            <TrendingUp className="mt-1 size-5 shrink-0 text-primary" />
          </div>

          {report ? (
            <div className="mt-4 flex-1 space-y-2.5">
              {breakdownRows.map((row) => {
                const pct = clampPercent(grossReceivable > 0 ? (Math.abs(row.value) / grossReceivable) * 100 : 0);
                return (
                  <div key={row.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
                    <span className={cn("size-2 shrink-0 rounded-full", row.color)} />
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">{row.label}</p>
                        <p className={cn("shrink-0 font-mono text-xs font-normal tabular-nums sm:hidden", row.value < 0 && "text-destructive")}>
                          {formatSignedPKR(row.value)}
                        </p>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`${row.label} share of gross receivable`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pct)}
                        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className={cn("h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", row.color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <p className={cn("hidden w-24 shrink-0 text-right font-mono text-sm font-normal tabular-nums sm:block", row.value < 0 && "text-destructive")}>
                      {formatSignedPKR(row.value)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Wallet}
              title="No incentive report yet."
              description="Receivable details will appear once activations are available."
              className="flex-1 py-10"
            />
          )}

          <div className="mt-4 grid gap-2 border-t pt-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Gross receivable</span>
              <span className="font-mono font-normal tabular-nums">{formatPKR(grossReceivable)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Less CR fines</span>
              <span className="font-mono font-normal tabular-nums text-destructive">-{formatPKR(data.crFines)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">Net receivable</span>
              <span className="font-mono font-normal tabular-nums text-primary">{formatPKR(netReceivable)}</span>
            </div>
          </div>
        </div>

        <div className="h-full xl:col-span-7">
          {data.sixMonthTrend.length > 0 ? (
            <DealerTrendChart data={data.sixMonthTrend} className="h-full" contentClassName="h-[260px] xl:h-[210px]" />
          ) : (
            <div className={cn(cardSurface, "flex h-full min-h-[276px] flex-col p-5")}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Earnings trend</p>
                <TrendingUp className="size-4 text-muted-foreground" />
              </div>
              <EmptyState
                icon={TrendingUp}
                title="No trend data yet."
                description="Earnings history will appear after monthly activity is recorded."
                className="flex-1 py-10"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RingMetricCard
          icon={BarChart3}
          title="Sell-through"
          value={`${salesVelocityPct}%`}
          subtitle="Sold from available units"
          percent={salesVelocityPct}
          tone="primary"
          footer={sellThroughFooter}
        />
        <RingMetricCard
          icon={Target}
          title="Activation summary"
          value={String(periodActs)}
          subtitle="Activations"
          percent={Math.round(targetPct)}
          tone="graphite"
          footer={hasTarget ? `${pendingTarget} pending target units` : "No target set"}
        />
        <TopModelCard topSelling={topSelling} models={topModels} total={salesTotal} />
        <RingMetricCard
          icon={Clock3}
          title="Aged stock (30+ days)"
          value={`${agedStockPct}%`}
          subtitle={`${data.agedStock.units} units aged`}
          percent={agedStockPct}
          tone="champagne"
          footer={`${formatCompactPKR(data.agedStock.value)} / ${data.agedStock.modelCount} model${data.agedStock.modelCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <div className={cn(cardSurface, "flex flex-col overflow-hidden")}>
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <p className="text-sm font-medium">Top selling models</p>
            <span className="font-mono text-sm font-normal tabular-nums text-primary">{salesTotal} total</span>
          </div>
          {salesSorted.length > 0 ? (
            <div className="flex-1 divide-y">
              {salesSorted.map((r, i) => {
                const pct = clampPercent(salesTotal > 0 ? (r.qty / salesTotal) * 100 : 0);
                const earnedRow = report?.rows.find((row) => row.modelId === r.modelId);
                return (
                  <div key={r.modelId} className="flex min-h-[52px] items-center gap-3 px-5 py-3">
                    <span className="w-4 shrink-0 text-xs font-normal text-muted-foreground/50">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-normal">{r.modelName}</p>
                      <div
                        role="progressbar"
                        aria-label={`${r.modelName} share of sales`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pct)}
                        className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                      >
                        <div className="h-full rounded-full bg-primary/70 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-normal tabular-nums">{r.qty}</p>
                      {earnedRow && (earnedRow.total + earnedRow.stockInEarned) > 0 && (
                        <p className="font-mono text-xs font-normal tabular-nums text-primary">{formatPKR(earnedRow.total + earnedRow.stockInEarned)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Trophy}
              title="No model sales in this period."
              description="Best selling models will appear after sales are recorded."
              className="flex-1 py-12"
            />
          )}
        </div>

        <div className={cn(cardSurface, "flex flex-col overflow-hidden")}>
          <div className="flex items-center gap-2 border-b px-5 py-3.5">
            <Boxes className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Stock on hand</p>
          </div>
          {data.stock.length > 0 ? (
            <div className="flex-1 divide-y">
              {data.stock.map((s) => (
                <div key={s.modelId} className="flex min-h-[56px] items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-normal">{s.modelName}</p>
                    {s.dealerPrice != null && (
                      <p className="truncate font-mono text-xs tabular-nums text-muted-foreground">{formatPKR(s.dealerPrice)} / unit</p>
                    )}
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="font-mono text-base font-normal tabular-nums">{s.quantity}</p>
                    {s.dealerPrice != null && s.quantity > 0 && (
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">{formatPKR(s.quantity * s.dealerPrice)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Boxes}
              title="No stock on hand."
              description="Stock will appear after purchases are approved."
              className="flex-1 py-12"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function QuickActions({
  pendingCrossRegion,
  pendingInbound,
  className,
}: {
  pendingCrossRegion: number;
  pendingInbound: number;
  className?: string;
}) {
  return (
    <div className={cn(cardSurface, "grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:flex lg:items-center lg:justify-end", className)}>
      <Link
        href="/dealer/activations"
        style={{ touchAction: "manipulation" }}
        className={cn(
          "dashboard-action flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition-[background-color,transform,opacity] duration-150 hover:opacity-90 active:scale-[0.98]",
          focusRing,
        )}
      >
        <Smartphone className="size-4" />
        Add Activation
      </Link>
      <Link
        href="/dealer/purchases"
        style={{ touchAction: "manipulation" }}
        className={cn(
          "dashboard-action flex min-h-11 items-center justify-center gap-2 rounded-xl bg-secondary px-3 text-sm font-medium transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.98]",
          focusRing,
        )}
      >
        <Package className="size-4" />
        Add Purchase
      </Link>
      {pendingCrossRegion > 0 && (
        <Link
          href="/dealer/cross-region"
          className={cn(
            "dashboard-action flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 text-xs font-medium text-foreground transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.98] sm:col-span-2 lg:col-span-auto",
            focusRing,
          )}
        >
          <ArrowLeftRight className="size-3.5" />
          {pendingCrossRegion} CR pending
        </Link>
      )}
      {pendingInbound > 0 && (
        <Link
          href="/dealer/cross-region"
          className={cn(
            "dashboard-action flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.98] sm:col-span-2 lg:col-span-auto",
            focusRing,
          )}
        >
          <ArrowDownToLine className="size-3.5" />
          {pendingInbound} inbound
        </Link>
      )}
    </div>
  );
}

function formatSignedPKR(value: number): string {
  if (value < 0) return `-${formatPKR(Math.abs(value))}`;
  return formatPKR(value);
}

function formatCompactPKR(value: number): string {
  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);
  if (n >= 1_000_000) return `${sign}Rs ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000) return `${sign}Rs ${Math.round(n / 1_000)}K`;
  return formatPKR(value);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

type RingTone = "primary" | "graphite" | "champagne";

const ringToneStyles: Record<RingTone, {
  color: string;
  soft: string;
  ring: string;
  text: string;
}> = {
  primary: {
    color: "var(--primary)",
    soft: "bg-secondary",
    ring: "ring-border",
    text: "text-primary",
  },
  graphite: {
    color: "var(--foreground)",
    soft: "bg-secondary",
    ring: "ring-border",
    text: "text-foreground",
  },
  champagne: {
    color: "var(--dashboard-champagne)",
    soft: "bg-accent",
    ring: "ring-border",
    text: "text-[color:var(--dashboard-champagne)]",
  },
};

function RingMetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  percent,
  footer,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  subtitle: string;
  percent: number;
  footer: string;
  tone: RingTone;
}) {
  const pct = clampPercent(percent);
  const toneStyle = ringToneStyles[tone];

  return (
    <div className={cn(
      cardSurface,
      "group flex min-h-[204px] p-5 transition-colors duration-150 hover:bg-secondary/70 xl:min-h-[188px]",
    )}>
      <div className="relative z-10 flex w-full flex-col">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-normal text-muted-foreground">{title}</p>
          <span className={cn("grid size-8 place-items-center rounded-xl ring-1 transition-transform duration-150 group-hover:scale-[1.03]", toneStyle.soft, toneStyle.ring)}>
            <Icon className={cn("size-4", toneStyle.text)} />
          </span>
        </div>
        <div className="mt-5 flex flex-1 items-center justify-center">
          <div
            role="meter"
            aria-label={title}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-valuetext={value}
            className="relative grid size-28 place-items-center rounded-full transition-transform duration-150 group-hover:scale-[1.01] xl:size-24"
            style={{
              background: `conic-gradient(${toneStyle.color} ${pct * 3.6}deg, color-mix(in oklab, var(--muted) 86%, transparent) 0deg)`,
            }}
          >
            <div className="absolute inset-2 rounded-full bg-card" />
            <div className="relative grid size-[5.35rem] place-items-center rounded-full bg-card text-center xl:size-[4.65rem]">
              <div>
                <p className={cn("font-mono text-base font-normal leading-none tabular-nums xl:text-sm", toneStyle.text)}>{value}</p>
                <p className="mt-1 max-w-[4.6rem] text-xs leading-tight text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <div className="absolute -bottom-1 rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-xs font-normal tabular-nums text-muted-foreground">
              {Math.round(pct)}%
            </div>
          </div>
        </div>
        <p className="mt-5 border-t border-border pt-3 text-center text-xs font-medium text-muted-foreground">
          {footer}
        </p>
      </div>
    </div>
  );
}

function TopModelCard({
  topSelling,
  models,
  total,
}: {
  topSelling?: { modelId: string; modelName: string; qty: number };
  models: Array<{ modelId: string; modelName: string; qty: number }>;
  total: number;
}) {
  return (
    <div className={cn(cardSurface, "flex min-h-[190px] flex-col p-5 xl:min-h-[176px]")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-normal text-muted-foreground">Best selling models</p>
        <Trophy className="size-4 text-muted-foreground" />
      </div>

      {topSelling ? (
        <>
          <div className="mt-4">
            <p className="truncate text-base font-normal">{topSelling.modelName}</p>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{topSelling.qty} sold this period</p>
          </div>
          <div className="mt-4 space-y-2">
            {models.map((model) => {
              const pct = clampPercent(total > 0 ? (model.qty / total) * 100 : 0);
              return (
                <div key={model.modelId} className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-normal">{model.modelName}</p>
                    <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{model.qty}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${model.modelName} share of best selling models`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(pct)}
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="font-mono text-2xl font-normal tabular-nums">0</p>
            <p className="mt-1 text-xs text-muted-foreground">No model sales in this period</p>
          </div>
        </div>
      )}

      <p className="mt-auto rounded-lg bg-muted/60 px-3 py-2 text-center font-mono text-xs font-normal tabular-nums text-muted-foreground">
        {total} total sold
      </p>
    </div>
  );
}

interface KpiProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
}

function KpiCard({ icon: Icon, label, value, sub, accent = false, danger = false }: KpiProps) {
  return (
    <div className={cn(
      cardSurface,
      "group flex h-full min-h-[112px] items-start justify-between gap-3 p-4 transition-[background-color,transform] duration-150 hover:bg-secondary/70 active:scale-[0.995] xl:min-h-[100px] xl:p-3 2xl:p-4",
      danger && "bg-destructive/5",
    )}>
      <div className="flex h-full min-w-0 flex-col">
        <p className="line-clamp-2 min-h-[2.1rem] text-[11px] font-medium leading-tight text-foreground/70">{label}</p>
        <p
          title={value}
          className={cn(
            "mt-1.5 max-w-full truncate whitespace-nowrap font-mono text-[1.02rem] font-semibold leading-none tabular-nums text-foreground xl:text-[0.95rem] 2xl:text-base",
            accent && "text-primary",
            danger && "text-destructive",
          )}
        >
          {value}
        </p>
        {sub && <p className="mt-auto line-clamp-1 pt-1.5 text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      <div className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105 xl:size-9 2xl:size-10",
        danger ? "bg-destructive/10" : "bg-secondary",
      )}>
        <Icon className={cn("size-5 xl:size-4 2xl:size-5", danger ? "text-destructive" : "text-primary")} />
      </div>
    </div>
  );
}

function PeriodPicker({
  startStr,
  endStr,
  label,
  className,
}: {
  startStr: string;
  endStr: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(startStr);
  const [to, setTo] = useState(endStr);

  const go = (f: string, t: string) => router.push(`/dealer/dashboard?from=${f}&to=${t}`);

  const monthPreset = (offset: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    const s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    setFrom(s);
    setTo(e);
    go(s, e);
  };

  return (
    <div className={cn(cardSurface, "p-3", className)}>
      <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs font-normal text-muted-foreground">Period</p>
          <span className="truncate font-mono text-xs font-normal tabular-nums">{label}</span>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 md:ml-auto md:w-auto md:flex md:flex-wrap md:justify-end">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className={cn("h-11 min-w-0 rounded-lg border bg-card px-2.5 text-sm", focusRing)}
            aria-label="From date"
          />
          <input
            type="date"
            value={to}
            min={from}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setTo(e.target.value)}
            className={cn("h-11 min-w-0 rounded-lg border bg-card px-2.5 text-sm", focusRing)}
            aria-label="To date"
          />
          <button
            onClick={() => go(from, to)}
            className={cn("dashboard-action h-11 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98]", focusRing)}
          >
            Apply
          </button>
          <button
            onClick={() => monthPreset(0)}
            className={cn("dashboard-action h-11 rounded-xl border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-[background-color,transform] duration-150 hover:bg-secondary active:scale-[0.98]", focusRing)}
          >
            This month
          </button>
          <button
            onClick={() => monthPreset(-1)}
            className={cn("dashboard-action h-11 rounded-xl border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-[background-color,transform] duration-150 hover:bg-secondary active:scale-[0.98]", focusRing)}
          >
            Last month
          </button>
        </div>
      </div>
    </div>
  );
}

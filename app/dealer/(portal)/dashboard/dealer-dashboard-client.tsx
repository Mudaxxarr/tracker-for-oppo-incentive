"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DaysRemainingAlert } from "./days-remaining-alert";
import { DealerTrendChart } from "./dealer-trend-chart";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Smartphone, Package, Boxes, ArrowLeftRight,
  ArrowDownToLine, ShieldAlert, ShieldCheck, TrendingUp, CheckCircle2,
  CalendarDays, Wallet, BadgePercent, Gauge, Layers, Target,
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
  stock: Array<{ modelId: string; modelName: string; quantity: number; dealerPrice: number | null }>;
  sixMonthTrend: Array<{ label: string; activations: number; earnings: number }>;
  report: {
    baseIncentivePercent: number;
    totalActivations: number;
    targetBonus: { eligible: boolean; targetQty: number | null; actualQty: number; bonusPercent: number };
    totals: { basePercentEarned: number; bonusPercentEarned: number; activationIncentiveEarned: number; dealerIncentiveEarned: number; stockInEarned: number; grandTotal: number };
    rows: Array<{ modelId: string; modelName: string; qtyActivated: number; stockInRegularQty: number; basePercentEarned: number; total: number; stockInEarned: number }>;
  } | null;
  crLoss: { lostIncentive: number; totalUnits: number } | null;
  initialSales: Array<{ modelId: string; modelName: string; qty: number }>;
  modelsWithIncentiveIds: string[];
}

export function DealerDashboardClient({ data }: { data: DashboardData }) {
  const { report, crLoss } = data;
  const tb = report?.targetBonus;
  const salesSorted = [...data.initialSales].sort((a, b) => b.qty - a.qty);
  const salesTotal = salesSorted.reduce((s, r) => s + r.qty, 0);
  const stockValue = data.stock.reduce((s, item) => s + item.quantity * (item.dealerPrice ?? 0), 0);

  const grand = report?.totals.grandTotal ?? 0;
  const periodActs = data.periodActivations;
  const avgPerActivation = periodActs > 0 ? grand / periodActs : 0;

  const targetPct = tb?.targetQty != null && tb.targetQty > 0
    ? Math.min(100, (tb.actualQty / tb.targetQty) * 100)
    : 0;

  const breakdownRows = report ? [
    { label: `Base ${report.baseIncentivePercent}%`, value: report.totals.basePercentEarned, color: "bg-primary" },
    { label: `Target Bonus ${tb?.bonusPercent ?? 0}%`, value: report.totals.bonusPercentEarned, color: "bg-amber-500" },
    { label: "Stock-In", value: report.totals.stockInEarned, color: "bg-blue-500" },
    { label: "Activation Incentive", value: report.totals.activationIncentiveEarned, color: "bg-violet-500" },
    { label: "Dealer Incentive", value: report.totals.dealerIncentiveEarned, color: "bg-orange-500" },
  ].filter((r) => r.value > 0) : [];

  return (
    <div className="mx-auto w-full max-w-2xl xl:max-w-[1400px] space-y-3" style={{ overscrollBehavior: "contain" }}>
      <style>{`
        @keyframes d-ring-pulse { 0%,100% { opacity:.30; transform:scale(1);} 50% { opacity:.07; transform:scale(1.2);} }
        @keyframes d-float { 0%,100% { transform:translateY(0);} 50% { transform:translateY(-6px);} }
        @keyframes d-glow-sweep { 0% { background-position:0% 50%;} 50% { background-position:100% 50%;} 100% { background-position:0% 50%;} }
        @keyframes d-slide-up { from { opacity:0; transform:translateY(12px);} to { opacity:1; transform:translateY(0);} }
        @keyframes d-dot-blink { 0%,100% { opacity:1;} 50% { opacity:.3;} }
        .d-ring-1 { animation: d-ring-pulse 4s ease-in-out infinite; }
        .d-ring-2 { animation: d-ring-pulse 4s ease-in-out infinite 1.5s; }
        .d-float  { animation: d-float 5s ease-in-out infinite; }
        .d-glow   { background: linear-gradient(225deg, hsl(var(--primary)/0.16) 0%, hsl(var(--primary)/0.05) 50%, hsl(var(--primary)/0.13) 100%); background-size:200% 200%; animation: d-glow-sweep 9s ease infinite; }
        .d-slide-1 { animation: d-slide-up .45s ease-out .05s both; }
        .d-slide-2 { animation: d-slide-up .45s ease-out .18s both; }
        .d-dot     { animation: d-dot-blink 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .d-ring-1,.d-ring-2,.d-float,.d-glow,.d-slide-1,.d-slide-2,.d-dot { animation: none !important; }
        }
      `}</style>

      {/* Full-width controls / alerts */}
      <PeriodPicker startStr={data.startStr} endStr={data.endStr} label={data.label} />
      <DaysRemainingAlert daysLeft={data.daysLeft} expiresAt={data.expiresAt} />
      {(data.pendingCrossRegion > 0 || data.pendingInbound > 0) && (
        <div className="flex flex-wrap gap-2">
          {data.pendingCrossRegion > 0 && (
            <Link href="/dealer/cross-region" className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-medium text-amber-700 transition-colors duration-150 hover:bg-amber-500/20 cursor-pointer">
              <ArrowLeftRight className="size-3.5" />
              {data.pendingCrossRegion} cross-region pending
            </Link>
          )}
          {data.pendingInbound > 0 && (
            <Link href="/dealer/cross-region" className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-medium text-blue-700 transition-colors duration-150 hover:bg-blue-500/20 cursor-pointer">
              <ArrowDownToLine className="size-3.5" />
              {data.pendingInbound} inbound pending
            </Link>
          )}
        </div>
      )}

      {/* ── Dashboard grid — single column on mobile, 12-col spread on PC ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:gap-4 xl:auto-rows-min xl:grid-flow-row-dense">

        {/* TODAY — animated hero */}
        <div className="rounded-2xl border d-glow overflow-hidden relative xl:col-span-4">
          <div className="pointer-events-none absolute -bottom-14 -right-14 size-56 rounded-full border-2 border-primary/20 d-ring-1" />
          <div className="pointer-events-none absolute -bottom-6 -right-6 size-36 rounded-full border border-primary/25 d-ring-2" />
          <div className="relative px-5 pt-5 pb-4">
            <div className="d-slide-1 flex items-center gap-2 mb-3">
              <span className="d-dot size-2 rounded-full bg-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Today</p>
            </div>
            <div className="d-slide-2 flex items-end justify-between gap-3">
              <div>
                <div className="d-float inline-block">
                  <p className="text-7xl font-black tabular-nums text-primary leading-none">{data.todayActivations}</p>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">activations today</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0 pb-1">
                <Link href="/dealer/activations" style={{ touchAction: "manipulation" }}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90 cursor-pointer">
                  <Smartphone className="size-4" />Add Activation
                </Link>
                <Link href="/dealer/purchases" style={{ touchAction: "manipulation" }}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border bg-background/60 backdrop-blur-sm px-4 text-sm font-semibold transition-colors duration-150 hover:bg-muted cursor-pointer">
                  <Package className="size-4" />Add Purchase
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Key metrics — aligned uniform grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:col-span-8 xl:content-start">
          <Metric icon={Wallet} label="Expected" value={formatPKR(grand)} accent sub={data.label} />
          <Metric icon={Smartphone} label="Activations" value={String(periodActs)} sub="this period" />
          <Metric icon={Gauge} label="Avg / Activation" value={periodActs > 0 ? formatPKR(avgPerActivation) : "—"} sub="incentive per unit" />
          <Metric icon={BadgePercent} label="Rebate" value={formatPKR(data.rebateEarned)} sub="price-drop" />
          <Metric icon={Layers} label="Stock Value" value={formatPKR(stockValue)} sub={`${data.totalStock} units`} />
          <Metric icon={Boxes} label="Stock" value={String(data.totalStock)} sub="units on hand" />
          <Metric icon={ShieldAlert} label="CR Fines" value={formatPKR(data.crFines)} danger={data.crFines > 0} sub="penalties" />
          <Metric icon={ShieldAlert} label="Risk Exposure" value={formatPKR(data.riskExposure)} danger={data.riskExposure > 0} sub="lost + fines" />
        </div>

        {/* Earnings breakdown */}
        {report && (
          <div className="rounded-xl border bg-card overflow-hidden xl:col-span-5">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Expected from OPPO — {data.label}</p>
                  <p className="text-2xl font-bold tabular-nums text-primary mt-0.5">{formatPKR(grand)}</p>
                </div>
                <TrendingUp className="size-4 text-primary mt-1 shrink-0" />
              </div>
              {breakdownRows.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {breakdownRows.map((row) => {
                    const pct = grand > 0 ? (row.value / grand) * 100 : 0;
                    return (
                      <div key={row.label} className="flex items-center gap-2">
                        <p className="w-36 shrink-0 text-xs text-muted-foreground truncate">{row.label}</p>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${row.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums">{formatPKR(row.value)}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No incentive components earned yet this period.</p>
              )}
            </div>
          </div>
        )}

        {/* Earnings trend (last 6 months) */}
        {data.sixMonthTrend.length > 0 && (
          <div className="xl:col-span-7">
            <DealerTrendChart data={data.sixMonthTrend} />
          </div>
        )}

        {/* Activations vs Target */}
        {report && tb?.targetQty != null && (
          <div className="rounded-xl border bg-card p-4 xl:col-span-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Activations vs Target</p>
              </div>
              <p className="text-sm font-bold tabular-nums">
                {tb.actualQty}<span className="text-muted-foreground font-normal"> / {tb.targetQty}</span>
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${targetPct}%`, background: tb.eligible ? "var(--primary)" : "#f97316" }} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              {tb.eligible ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <CheckCircle2 className="size-3" /> Target met — {tb.bonusPercent}% bonus unlocked
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  {Math.max(0, (tb.targetQty ?? 0) - tb.actualQty)} more to unlock {tb.bonusPercent}% bonus
                </span>
              )}
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{Math.round(targetPct)}%</span>
            </div>
          </div>
        )}

        {/* CR Monitor */}
        {crLoss && crLoss.lostIncentive > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 xl:col-span-4">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">CR Caught — {crLoss.totalUnits} units</p>
              <p className="text-xs text-muted-foreground">
                Lost incentive {formatPKR(crLoss.lostIncentive)}
                {data.crFines > 0 ? ` · fines ${formatPKR(data.crFines)}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 xl:col-span-4">
            <ShieldCheck className="size-4 shrink-0 text-emerald-500" />
            <p className="text-sm font-medium text-muted-foreground">CR Monitor — <span className="text-emerald-600 font-semibold">No CR risk</span></p>
          </div>
        )}

        {/* Top Selling Models */}
        {salesSorted.length > 0 && (
          <div className="rounded-xl border bg-card overflow-hidden xl:col-span-4">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-semibold">Top Selling Models</p>
              <span className="text-sm font-bold tabular-nums text-primary">{salesTotal} total</span>
            </div>
            <div className="divide-y">
              {salesSorted.map((r, i) => {
                const pct = salesTotal > 0 ? (r.qty / salesTotal) * 100 : 0;
                const earnedRow = report?.rows.find((row) => row.modelId === r.modelId);
                return (
                  <div key={r.modelId} className="flex min-h-[52px] items-center gap-3 px-4 py-3">
                    <span className="text-xs font-bold text-muted-foreground/50 w-4 shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.modelName}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums">{r.qty}</p>
                      {earnedRow && (earnedRow.total + earnedRow.stockInEarned) > 0 && (
                        <p className="text-[10px] text-primary tabular-nums font-medium">{formatPKR(earnedRow.total + earnedRow.stockInEarned)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stock on Hand */}
        {data.stock.length > 0 && (
          <div className="rounded-xl border bg-card overflow-hidden xl:col-span-12">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Boxes className="size-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Stock on Hand</p>
            </div>
            <div className="divide-y xl:grid xl:grid-cols-2 xl:divide-y-0 xl:gap-x-6">
              {data.stock.map((s) => (
                <div key={s.modelId} className="flex items-center justify-between px-4 py-3 xl:border-b">
                  <div>
                    <p className="text-sm font-medium">{s.modelName}</p>
                    {s.dealerPrice != null && (
                      <p className="text-xs text-muted-foreground tabular-nums">{formatPKR(s.dealerPrice)} / unit</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums">{s.quantity}</p>
                    {s.dealerPrice != null && s.quantity > 0 && (
                      <p className="text-[10px] text-muted-foreground tabular-nums">{formatPKR(s.quantity * s.dealerPrice)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Uniform metric tile ───────────────────────────────────
function Metric({
  icon: Icon, label, value, sub, accent = false, danger = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-3 flex flex-col gap-1",
      danger && "border-destructive/30 bg-destructive/5",
    )}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-3.5 shrink-0", danger ? "text-destructive" : "text-muted-foreground")} />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      </div>
      <p className={cn(
        "text-lg font-bold tabular-nums leading-tight",
        accent && "text-primary",
        danger && "text-destructive",
      )}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

// ── Custom date-range picker (drives all period metrics via ?from&to) ──
function PeriodPicker({ startStr, endStr, label }: { startStr: string; endStr: string; label: string }) {
  const router = useRouter();
  const [from, setFrom] = useState(startStr);
  const [to, setTo] = useState(endStr);

  const go = (f: string, t: string) => {
    router.push(`/dealer/dashboard?from=${f}&to=${t}`);
  };

  const monthPreset = (offset: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    const s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    setFrom(s); setTo(e); go(s, e);
  };

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">Period</p>
        <span className="text-xs font-semibold tabular-nums">{label}</span>
        <div className="flex flex-wrap items-end gap-2 ml-auto">
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-lg border bg-background px-2.5 text-sm" aria-label="From date" />
          <input type="date" value={to} min={from} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border bg-background px-2.5 text-sm" aria-label="To date" />
          <button onClick={() => go(from, to)}
            className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            Apply
          </button>
          <button onClick={() => monthPreset(0)} className="h-9 rounded-lg border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">This month</button>
          <button onClick={() => monthPreset(-1)} className="h-9 rounded-lg border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">Last month</button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/feature/kpi-card";
import { DaysRemainingAlert } from "./days-remaining-alert";
import { DealerDashboardAnalytics } from "./dealer-dashboard-analytics";
import { DealerTrendChart } from "./dealer-trend-chart";
import { formatPKR } from "@/lib/format";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Smartphone, CalendarDays, Package, ArrowLeftRight, ArrowDownToLine,
  Boxes, Clock, Percent, Award, Truck, Wallet, ShieldAlert,
  LayoutGrid, BarChart3, Layers, AlignJustify,
} from "lucide-react";

// ─── Data shape (server → client) ────────────────────────────────────────────

export interface DashboardData {
  dealerName: string | null;
  label: string;
  startStr: string;
  endStr: string;
  daysLeft: number;
  expiresAt: string;
  todayActivations: number;
  monthActivations: number;
  purchaseRecords: number;
  totalStock: number;
  pendingCrossRegion: number;
  pendingInbound: number;
  stock: Array<{ modelId: string; modelName: string; quantity: number; dealerPrice: number | null }>;
  sixMonthTrend: Array<{ label: string; activations: number }>;
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

type Theme = "cards" | "charts" | "overview" | "compact";

const STORAGE_KEY = "dealer_dash_theme";
const MODEL_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f97316","#14b8a6","#22c55e","#3b82f6","#a855f7","#eab308","#ef4444"];

// ─── Root client component ────────────────────────────────────────────────────

export function DealerDashboardClient({ data }: { data: DashboardData }) {
  const [theme, setTheme] = useState<Theme>("cards");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved && ["cards","charts","overview","compact"].includes(saved)) setTheme(saved);
  }, []);

  const switchTheme = (t: Theme) => {
    setTheme(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  const THEMES: { key: Theme; icon: React.ReactNode; label: string }[] = [
    { key: "cards",    icon: <LayoutGrid className="size-4" />,    label: "Cards" },
    { key: "charts",   icon: <BarChart3 className="size-4" />,     label: "Charts" },
    { key: "overview", icon: <Layers className="size-4" />,        label: "Overview" },
    { key: "compact",  icon: <AlignJustify className="size-4" />,  label: "Compact" },
  ];

  return (
    <div className="space-y-6">
      <DaysRemainingAlert daysLeft={data.daysLeft} expiresAt={data.expiresAt} />

      {/* Header + theme switcher */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            <strong>{data.dealerName}</strong> — {data.label}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(data.pendingCrossRegion > 0 || data.pendingInbound > 0) && (
            <div className="flex gap-1.5">
              {data.pendingCrossRegion > 0 && (
                <Badge variant="outline" className="gap-1">
                  <ArrowLeftRight className="size-3" />{data.pendingCrossRegion} cross-region
                </Badge>
              )}
              {data.pendingInbound > 0 && (
                <Badge variant="outline" className="gap-1">
                  <ArrowDownToLine className="size-3" />{data.pendingInbound} inbound
                </Badge>
              )}
            </div>
          )}
          {/* Theme switcher */}
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
            {THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => switchTheme(t.key)}
                title={t.label}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  theme === t.key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {theme === "cards"    && <ThemeCards    data={data} />}
      {theme === "charts"   && <ThemeCharts   data={data} />}
      {theme === "overview" && <ThemeOverview data={data} />}
      {theme === "compact"  && <ThemeCompact  data={data} />}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function modelsWithIncentiveSet(data: DashboardData) {
  return new Set(data.modelsWithIncentiveIds);
}

function incentiveRows(data: DashboardData) {
  return (data.report?.rows ?? []).filter((r) => r.total > 0 || r.stockInEarned > 0).sort((a, b) => b.qtyActivated - a.qtyActivated);
}

// ─── THEME 1: Cards (current grid layout) ────────────────────────────────────

function ThemeCards({ data }: { data: DashboardData }) {
  const { report, crLoss } = data;
  const tb = report?.targetBonus;
  const modelsSet = modelsWithIncentiveSet(data);
  const incentRows = incentiveRows(data);
  const stockWithIncentive = data.stock.filter((s) => modelsSet.has(s.modelId));

  return (
    <div className="space-y-6">
      {/* Activations chart — hero */}
      <DealerDashboardAnalytics initialRows={data.initialSales} initialFrom={data.startStr} initialTo={data.endStr} />

      {/* Activity KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <KpiCard label="Today's Activations"   value={data.todayActivations}     icon={<Smartphone className="size-4" />} />
        <KpiCard label="Month Activations"     value={data.monthActivations}     icon={<CalendarDays className="size-4" />} />
        <KpiCard label="Purchases This Month"  value={data.purchaseRecords}      icon={<Package className="size-4" />} />
        <KpiCard label="Units on Hand"         value={data.totalStock}           icon={<Boxes className="size-4" />} />
        <KpiCard label="Cross-Region Pending"  value={data.pendingCrossRegion}   icon={<ArrowLeftRight className="size-4" />} highlightZero />
        <KpiCard label="Inbound Transfers"     value={data.pendingInbound}       icon={<ArrowDownToLine className="size-4" />} highlightZero />
        <KpiCard label="Days Left"             value={Math.max(0, data.daysLeft)} icon={<Clock className="size-4" />} highlightZero />
      </div>

      {/* Incentive KPIs */}
      {report && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard label={`${report.baseIncentivePercent}% earned`} value={report.totals.basePercentEarned} format="currency" icon={<Percent className="size-4" />} />
          <KpiCard label={`Target bonus ${tb?.bonusPercent ?? 0}%`} value={report.totals.bonusPercentEarned} format="currency" icon={<Award className="size-4" />} highlightZero
            progress={tb?.targetQty != null ? { current: tb.actualQty, target: tb.targetQty } : undefined}
            helper={tb?.eligible ? "Purchase target met ✓" : `${tb?.actualQty ?? 0}/${tb?.targetQty ?? "—"} purchased`} />
          <KpiCard label="Activation incentive"     value={report.totals.activationIncentiveEarned} format="currency" icon={<Smartphone className="size-4" />} />
          <KpiCard label="Dealer incentive"         value={report.totals.dealerIncentiveEarned}     format="currency" icon={<Award className="size-4" />} />
          <KpiCard label="Stock-In earned"          value={report.totals.stockInEarned}             format="currency" icon={<Truck className="size-4" />} />
          <KpiCard label="Total expected from OPPO" value={report.totals.grandTotal}                format="currency" icon={<Wallet className="size-4" />} />
        </div>
      )}

      {crLoss && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KpiCard label="CR Caught Loss (est.)" value={crLoss.lostIncentive} format="currency" icon={<ShieldAlert className="size-4" />} highlightZero
            helper={crLoss.totalUnits > 0 ? `${crLoss.totalUnits} units caught` : "No catches this month"} />
        </div>
      )}

      {data.sixMonthTrend.length > 0 && <DealerTrendChart data={data.sixMonthTrend} />}

      {/* Current Stock */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Boxes className="size-4" />Current Stock</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.stock.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No stock on hand.</div>
          ) : (
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {data.stock.map((s) => (
                <div key={s.modelId} className="flex flex-col gap-1 bg-card p-3">
                  <span className="truncate text-xs font-medium leading-tight">{s.modelName}</span>
                  <span className="text-2xl font-bold tabular-nums">{s.quantity}</span>
                  <div className="flex flex-wrap gap-1">
                    {s.dealerPrice != null && <span className="text-[10px] tabular-nums text-muted-foreground">{formatPKR(s.dealerPrice)}</span>}
                    {!modelsSet.has(s.modelId) && <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">no incentive</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incentive models breakdown */}
      {report && (stockWithIncentive.length > 0 || report.rows.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Incentive models — {data.label}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {incentRows.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No incentive earned yet this month.</div>
              ) : incentRows.map((row) => (
                <div key={row.modelId} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{row.modelName}</div>
                    <div className="text-xs text-muted-foreground">{row.qtyActivated} activated · {row.stockInRegularQty} stocked</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium tabular-nums">{formatPKR(row.total)}</div>
                    <div className="text-xs text-muted-foreground">{report.baseIncentivePercent}% {formatPKR(row.basePercentEarned)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── THEME 2: Charts (Recharts-heavy) ────────────────────────────────────────

function ThemeCharts({ data }: { data: DashboardData }) {
  const { report, crLoss } = data;
  const tb = report?.targetBonus;
  const incentRows = incentiveRows(data);

  const pieData = data.initialSales.length > 0
    ? [...data.initialSales].sort((a, b) => b.qty - a.qty).slice(0, 8)
    : [];
  const pieTotal = pieData.reduce((s, r) => s + r.qty, 0);

  const earningsData = report ? [
    { name: `${report.baseIncentivePercent}% Base`, value: report.totals.basePercentEarned, color: "#6366f1" },
    { name: "Target Bonus",   value: report.totals.bonusPercentEarned,        color: "#8b5cf6" },
    { name: "Activation Inc", value: report.totals.activationIncentiveEarned, color: "#ec4899" },
    { name: "Dealer Inc",     value: report.totals.dealerIncentiveEarned,     color: "#f97316" },
    { name: "Stock-In",       value: report.totals.stockInEarned,             color: "#14b8a6" },
  ].filter((e) => e.value > 0) : [];

  const tooltipStyle = {
    background: "var(--popover)", color: "var(--popover-foreground)",
    border: "1px solid var(--border)", borderRadius: 8, fontSize: 12,
  };

  return (
    <div className="space-y-6">
      {/* 6-month area chart */}
      {data.sixMonthTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activation Trend — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent className="h-56 p-4 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.sixMonthTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v), "Activations"]} />
                <Area type="monotone" dataKey="activations" stroke="#6366f1" strokeWidth={2.5} fill="url(#actGrad)" dot={{ r: 3, fill: "#6366f1" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Today", value: data.todayActivations,    icon: <Smartphone className="size-4" />, color: "#6366f1" },
          { label: "Month Activations", value: data.monthActivations,    icon: <CalendarDays className="size-4" />, color: "#8b5cf6" },
          { label: "Units on Hand", value: data.totalStock,    icon: <Boxes className="size-4" />,       color: "#14b8a6" },
          { label: "Days Left", value: Math.max(0, data.daysLeft), icon: <Clock className="size-4" />, color: data.daysLeft <= 7 ? "#ef4444" : "#f97316" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <span className="text-3xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Two-col: Pie + Earnings bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Model split pie */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Activation Share by Model</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-44 w-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="qty" nameKey="modelName" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v, _n, props) => [`${v} (${Math.round((Number(v)/pieTotal)*100)}%)`, props.payload.modelName]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {pieData.map((r, i) => (
                    <div key={r.modelId} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                      <span className="min-w-0 flex-1 truncate text-xs">{r.modelName}</span>
                      <span className="shrink-0 tabular-nums font-semibold">{r.qty}</span>
                    </div>
                  ))}
                  <div className="mt-2 border-t pt-2 text-xs font-semibold text-muted-foreground">
                    Total: {pieTotal}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Earnings bar chart */}
        {earningsData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Earnings Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground">Total: <strong>{formatPKR(report!.totals.grandTotal)}</strong></p>
            </CardHeader>
            <CardContent className="h-44 p-4 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={earningsData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatPKR(Number(v)), "Earned"]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {earningsData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Target bonus progress */}
      {report && tb?.targetQty != null && (
        <Card>
          <CardHeader><CardTitle className="text-base">Target Bonus Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Purchases: <strong>{tb.actualQty}</strong> / {tb.targetQty} needed</span>
              <span className={tb.eligible ? "font-semibold text-green-600" : "text-muted-foreground"}>
                {tb.eligible ? `✓ Earning ${tb.bonusPercent}% bonus` : `${tb.targetQty - tb.actualQty} more to unlock`}
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, tb.targetQty > 0 ? (tb.actualQty / tb.targetQty) * 100 : 0)}%`,
                  background: tb.eligible ? "#22c55e" : "#8b5cf6",
                }}
              />
            </div>
            {tb.eligible && (
              <p className="mt-2 text-sm font-semibold text-green-600">
                Bonus earned: {formatPKR(report.totals.bonusPercentEarned)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* CR loss */}
      {crLoss && crLoss.lostIncentive > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">CR Caught Loss — {formatPKR(crLoss.lostIncentive)}</p>
              <p className="text-xs text-muted-foreground">{crLoss.totalUnits} units caught this month, estimated incentive lost</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── THEME 3: Overview (executive split layout) ───────────────────────────────

function ThemeOverview({ data }: { data: DashboardData }) {
  const { report, crLoss } = data;
  const tb = report?.targetBonus;
  const incentRows = incentiveRows(data);
  const modelsSet = modelsWithIncentiveSet(data);
  const salesSorted = [...data.initialSales].sort((a, b) => b.qty - a.qty);
  const salesTotal = salesSorted.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="space-y-6">
      {/* Grand total hero banner */}
      {report && (
        <div className="relative overflow-hidden rounded-2xl p-6" style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)" }}>
          <div className="relative z-10">
            <p className="text-sm font-medium text-white/70">Total Expected from OPPO — {data.label}</p>
            <p className="mt-1 text-5xl font-bold tracking-tight text-white tabular-nums">
              {formatPKR(report.totals.grandTotal)}
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <div className="text-white/80 text-sm">
                <span className="font-semibold text-white">{report.baseIncentivePercent}%</span> base — {formatPKR(report.totals.basePercentEarned)}
              </div>
              {report.totals.bonusPercentEarned > 0 && (
                <div className="text-white/80 text-sm">
                  <span className="font-semibold text-white">{tb?.bonusPercent}%</span> bonus — {formatPKR(report.totals.bonusPercentEarned)}
                </div>
              )}
              {report.totals.stockInEarned > 0 && (
                <div className="text-white/80 text-sm">
                  Stock-in — {formatPKR(report.totals.stockInEarned)}
                </div>
              )}
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -right-4 h-56 w-56 rounded-full bg-white/5" />
        </div>
      )}

      {/* Key metrics row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {[
          { label: "Today",    value: data.todayActivations,     sub: "activations",     color: "#6366f1" },
          { label: "Month",    value: data.monthActivations,     sub: "activations",     color: "#8b5cf6" },
          { label: "Purchases",value: data.purchaseRecords,      sub: "this month",      color: "#14b8a6" },
          { label: "Stock",    value: data.totalStock,           sub: "units on hand",   color: "#f97316" },
          { label: "Days Left",value: Math.max(0, data.daysLeft),sub: "subscription",    color: data.daysLeft <= 7 ? "#ef4444" : "#22c55e" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 rounded-xl border bg-card p-4">
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className="text-3xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
            <span className="text-[10px] text-muted-foreground">{s.sub}</span>
          </div>
        ))}
      </div>

      {/* Split: model chart | incentive breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Model activations — 3 cols */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Activations by Model</CardTitle>
              {salesTotal > 0 && (
                <span className="text-2xl font-bold tabular-nums text-primary">{salesTotal}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {salesSorted.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No activations this month.</div>
            ) : (
              <div className="divide-y">
                {salesSorted.map((r, i) => {
                  const pct = salesTotal > 0 ? (r.qty / salesTotal) * 100 : 0;
                  const color = MODEL_COLORS[i % MODEL_COLORS.length];
                  return (
                    <div key={r.modelId} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>{i+1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.modelName}</span>
                      <div className="hidden w-32 sm:block">
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: `${color}22` }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                        <span className="text-lg font-bold tabular-nums" style={{ color }}>{r.qty}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial summary — 2 cols */}
        <div className="space-y-4 lg:col-span-2">
          {report && (
            <Card>
              <CardHeader><CardTitle className="text-base">Incentive Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: `${report.baseIncentivePercent}% Base`,    value: report.totals.basePercentEarned,         color: "#6366f1" },
                  { label: `${tb?.bonusPercent ?? 0}% Target Bonus`,  value: report.totals.bonusPercentEarned,        color: "#8b5cf6" },
                  { label: "Activation Incentive",                     value: report.totals.activationIncentiveEarned, color: "#ec4899" },
                  { label: "Dealer Incentive",                         value: report.totals.dealerIncentiveEarned,     color: "#f97316" },
                  { label: "Stock-In",                                 value: report.totals.stockInEarned,             color: "#14b8a6" },
                ].map((e) => (
                  <div key={e.label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                      <span className="truncate text-sm text-muted-foreground">{e.label}</span>
                    </div>
                    <span className={`shrink-0 tabular-nums text-sm font-semibold ${e.value === 0 ? "text-muted-foreground/50" : ""}`}>
                      {formatPKR(e.value)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-base font-bold tabular-nums text-primary">{formatPKR(report.totals.grandTotal)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Target bonus mini card */}
          {tb?.targetQty != null && (
            <Card>
              <CardContent className="pt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Target Bonus ({tb.bonusPercent}%)</span>
                  <span className={tb.eligible ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                    {tb.actualQty}/{tb.targetQty}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, (tb.actualQty/tb.targetQty)*100)}%`, background: tb.eligible ? "#22c55e" : "#8b5cf6" }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {tb.eligible ? "✓ Target met — bonus unlocked" : `${tb.targetQty - tb.actualQty} more purchases needed`}
                </p>
              </CardContent>
            </Card>
          )}

          {crLoss && crLoss.lostIncentive > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-xs font-semibold text-destructive">CR Caught Loss</p>
              <p className="text-xl font-bold tabular-nums text-destructive">{formatPKR(crLoss.lostIncentive)}</p>
              <p className="text-xs text-muted-foreground">{crLoss.totalUnits} units caught</p>
            </div>
          )}
        </div>
      </div>

      {/* Stock grid */}
      {data.stock.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Boxes className="size-4" />Current Stock</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {data.stock.map((s, i) => {
                const color = MODEL_COLORS[i % MODEL_COLORS.length];
                return (
                  <div key={s.modelId} className="flex flex-col gap-1 bg-card p-3">
                    <span className="truncate text-xs font-medium leading-tight">{s.modelName}</span>
                    <span className="text-2xl font-bold tabular-nums" style={{ color }}>{s.quantity}</span>
                    <div className="flex flex-wrap gap-1">
                      {s.dealerPrice != null && <span className="text-[10px] tabular-nums text-muted-foreground">{formatPKR(s.dealerPrice)}</span>}
                      {!modelsSet.has(s.modelId) && <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">no incentive</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Incentive models table */}
      {incentRows.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Incentive Models — {data.label}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Model</th>
                  <th className="px-4 py-2 text-right font-medium">Activated</th>
                  <th className="px-4 py-2 text-right font-medium">Stocked</th>
                  <th className="px-4 py-2 text-right font-medium">{report!.baseIncentivePercent}%</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {incentRows.map((row, i) => (
                  <tr key={row.modelId} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                        {row.modelName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.qtyActivated}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.stockInRegularQty}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatPKR(row.basePercentEarned)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{incentRows.reduce((s, r) => s + r.qtyActivated, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{incentRows.reduce((s, r) => s + r.stockInRegularQty, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatPKR(incentRows.reduce((s, r) => s + r.basePercentEarned, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary">{formatPKR(report!.totals.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── THEME 4: Compact (dense, power-user) ────────────────────────────────────

function ThemeCompact({ data }: { data: DashboardData }) {
  const { report, crLoss } = data;
  const tb = report?.targetBonus;
  const incentRows = incentiveRows(data);
  const modelsSet = modelsWithIncentiveSet(data);
  const salesSorted = [...data.initialSales].sort((a, b) => b.qty - a.qty);
  const salesTotal = salesSorted.reduce((s, r) => s + r.qty, 0);

  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <div className="sticky top-0 z-10 border-b bg-background/95 px-3 py-1.5 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
    </div>
  );

  const Row = ({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) => (
    <div className={`flex items-center justify-between px-3 py-2 ${highlight ? "bg-primary/5" : "hover:bg-muted/30"}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</span>
    </div>
  );

  return (
    <div className="divide-y rounded-xl border text-sm">
      {/* Activity */}
      <SectionHeader>Activity — {data.label}</SectionHeader>
      <Row label="Today's activations"  value={data.todayActivations} />
      <Row label="Month activations"    value={data.monthActivations} />
      <Row label="Purchases this month" value={data.purchaseRecords} />
      <Row label="Units on hand"        value={data.totalStock} />
      {data.pendingCrossRegion > 0 && <Row label="Cross-region pending" value={<span className="text-orange-500">{data.pendingCrossRegion}</span>} />}
      {data.pendingInbound > 0     && <Row label="Inbound pending"      value={<span className="text-blue-500">{data.pendingInbound}</span>} />}
      <Row label="Subscription days left" value={
        <span className={Math.max(0, data.daysLeft) <= 7 ? "text-destructive" : ""}>{Math.max(0, data.daysLeft)}</span>
      } />

      {/* Incentive earnings */}
      {report && (
        <>
          <SectionHeader>Incentive Earnings</SectionHeader>
          <Row label={`${report.baseIncentivePercent}% base incentive`} value={formatPKR(report.totals.basePercentEarned)} />
          <Row label={`${tb?.bonusPercent ?? 0}% target bonus`}         value={formatPKR(report.totals.bonusPercentEarned)} />
          <Row label="Activation incentive"                             value={formatPKR(report.totals.activationIncentiveEarned)} />
          <Row label="Dealer incentive"                                 value={formatPKR(report.totals.dealerIncentiveEarned)} />
          <Row label="Stock-in earned"                                  value={formatPKR(report.totals.stockInEarned)} />
          <Row label="Total expected from OPPO"                         value={formatPKR(report.totals.grandTotal)} highlight />
        </>
      )}

      {/* Target bonus status */}
      {tb?.targetQty != null && (
        <>
          <SectionHeader>Target Bonus ({tb.bonusPercent}%)</SectionHeader>
          <div className="px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Purchases: {tb.actualQty} / {tb.targetQty}</span>
              <span className={tb.eligible ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                {tb.eligible ? "✓ Unlocked" : `${tb.targetQty - tb.actualQty} remaining`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (tb.actualQty/tb.targetQty)*100)}%`, background: tb.eligible ? "#22c55e" : "#8b5cf6" }} />
            </div>
          </div>
        </>
      )}

      {/* CR Loss */}
      {crLoss && crLoss.lostIncentive > 0 && (
        <>
          <SectionHeader>CR Caught</SectionHeader>
          <Row label={`${crLoss.totalUnits} units caught`} value={<span className="text-destructive">-{formatPKR(crLoss.lostIncentive)}</span>} />
        </>
      )}

      {/* Activations by model */}
      {salesSorted.length > 0 && (
        <>
          <SectionHeader>Activations by Model</SectionHeader>
          {salesSorted.map((r, i) => {
            const pct = salesTotal > 0 ? (r.qty / salesTotal) * 100 : 0;
            const color = MODEL_COLORS[i % MODEL_COLORS.length];
            return (
              <div key={r.modelId} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: color }}>{i+1}</span>
                <span className="min-w-0 flex-1 truncate text-xs">{r.modelName}</span>
                <div className="hidden w-20 sm:block">
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: `${color}22` }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums">{r.qty}</span>
                <span className="shrink-0 w-8 text-right text-[10px] text-muted-foreground">{Math.round(pct)}%</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-t bg-muted/20">
            <span>{salesSorted.length} models</span>
            <span className="font-semibold tabular-nums text-foreground">{salesTotal} total</span>
          </div>
        </>
      )}

      {/* Stock */}
      {data.stock.length > 0 && (
        <>
          <SectionHeader>Stock on Hand</SectionHeader>
          {data.stock.map((s) => (
            <div key={s.modelId} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-xs">{s.modelName}</span>
                {!modelsSet.has(s.modelId) && <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">no incentive</span>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {s.dealerPrice != null && <span className="text-[10px] tabular-nums text-muted-foreground">{formatPKR(s.dealerPrice)}</span>}
                <span className="text-sm font-bold tabular-nums">{s.quantity}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Incentive model detail */}
      {incentRows.length > 0 && (
        <>
          <SectionHeader>Incentive Models</SectionHeader>
          {incentRows.map((row, i) => (
            <div key={row.modelId} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                <span className="truncate text-xs font-medium">{row.modelName}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{row.qtyActivated}act · {row.stockInRegularQty}stk</span>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums">{formatPKR(row.total)}</span>
            </div>
          ))}
        </>
      )}

      {/* 6-month trend */}
      {data.sixMonthTrend.length > 0 && (
        <>
          <SectionHeader>6-Month Trend</SectionHeader>
          <div className="px-3 py-3">
            <div className="flex h-16 items-end gap-1.5">
              {data.sixMonthTrend.map((m, i) => {
                const max = Math.max(...data.sixMonthTrend.map((x) => x.activations), 1);
                const h = Math.max(8, (m.activations / max) * 100);
                const isLast = i === data.sixMonthTrend.length - 1;
                return (
                  <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[9px] tabular-nums text-muted-foreground">{m.activations}</span>
                    <div className="w-full overflow-hidden rounded-sm" style={{ height: `${h}%`, background: isLast ? "#6366f1" : "#6366f120", minHeight: 8 }} />
                    <span className="text-[9px] text-muted-foreground">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

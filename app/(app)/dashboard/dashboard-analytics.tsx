"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/feature/kpi-card";
import { TrendCharts } from "@/components/feature/trend-charts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Smartphone,
  Percent,
  Award,
  Truck,
  Wallet,
  ArrowLeftRight,
  ArrowRight,
  Package,
  ShieldAlert,
  Download,
  LayoutGrid,
  BarChart2,
  List,
  AlignJustify,
  TrendingUp,
  FileText,
  Zap,
  Calendar,
  Briefcase,
  RefreshCw,
} from "lucide-react";
import { formatPKR } from "@/lib/format";
import Link from "next/link";
import type { IncentiveReport } from "@/lib/incentive-engine/types";
import { getDashboardPeriodAction, type ModelSaleRow } from "./actions";

type Preset = "today" | "week" | "month" | "custom";
type Layout = "cards" | "charts" | "overview" | "compact" | "financial" | "performance" | "timeline" | "executive";

interface StockItem {
  modelId: string;
  modelName: string;
  dealerPrice: number | null;
  quantity: number;
}

interface MonthRow {
  label: string;
  total: number;
  activations: number;
}

interface Props {
  dealerName: string;
  initialFrom: string;
  initialTo: string;
  initialReport: IncentiveReport;
  initialModelSales: ModelSaleRow[];
  initialCrLoss: { lostIncentive: number; totalUnits: number };
  initialRebateTotal: number;
  sixMonths: MonthRow[];
  stock: StockItem[];
  movedTo: Record<string, string[]>;
  pendingCount: number;
}

function presetRange(p: Preset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "today") return { from: fmt(today), to: fmt(today) };
  if (p === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return { from: fmt(start), to: fmt(today) };
  }
  if (p === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: fmt(start), to: fmt(end) };
  }
  return { from: fmt(today), to: fmt(today) };
}

function periodLabel(from: string, to: string): string {
  if (from === to) return from;
  return `${from} → ${to}`;
}

const LAYOUTS: { id: Layout; icon: typeof LayoutGrid; label: string }[] = [
  { id: "cards", icon: LayoutGrid, label: "Cards" },
  { id: "charts", icon: BarChart2, label: "Charts" },
  { id: "overview", icon: List, label: "Overview" },
  { id: "compact", icon: AlignJustify, label: "Compact" },
  { id: "financial", icon: FileText, label: "Financial" },
  { id: "performance", icon: Zap, label: "Performance" },
  { id: "timeline", icon: Calendar, label: "Timeline" },
  { id: "executive", icon: Briefcase, label: "Executive" },
];

/** Lightweight model-sales chart with date filtering — used by the team dashboard. */
export function DashboardAnalytics({
  initialRows,
  initialFrom,
  initialTo,
}: {
  initialRows: ModelSaleRow[];
  initialFrom: string;
  initialTo: string;
}) {
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [rows, setRows] = useState<ModelSaleRow[]>(initialRows);
  const [pending, startTransition] = useTransition();

  const load = (f: string, t: string) => {
    startTransition(async () => {
      const data = await getDashboardPeriodAction(f, t);
      if (data) setRows(data.modelSales);
    });
  };

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from: f, to: t } = presetRange(p);
      setFrom(f);
      setTo(t);
      load(f, t);
    }
  };

  const total = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="size-4" />
            Model-wise Sales
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {(["month", "week", "today", "custom"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  preset === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p === "month" ? "This Month" : p === "week" ? "This Week" : p === "today" ? "Today" : "Custom"}
              </button>
            ))}
            {preset === "custom" && (
              <div className="flex items-center gap-1">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 w-32 text-xs" />
                <span className="text-xs text-muted-foreground">→</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 w-32 text-xs" />
                <Button size="sm" className="h-7 text-xs" onClick={() => load(from, to)}>Apply</Button>
              </div>
            )}
            {pending && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No activations in this period.</div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => {
              const pct = total > 0 ? (r.qty / total) * 100 : 0;
              return (
                <div key={r.modelId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-36 shrink-0 text-sm font-medium truncate">{r.modelName}</div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold tabular-nums">{r.qty} sold</div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground border-t">
              <span>{rows.length} model(s)</span>
              <span className="font-semibold text-foreground tabular-nums">{total} total</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Policy Progress Card ────────────────────────────────────────────────────
function PolicyProgressCard({ report, rebateTotal }: { report: IncentiveReport; rebateTotal: number }) {
  const tb = report.targetBonus;

  const policies = [
    {
      label: `Base ${report.baseIncentivePercent}% Incentive`,
      sub: `${report.totalActivations} activations`,
      earned: report.totals.basePercentEarned,
      pct: 100,
      color: "#8b5cf6",
    },
    ...(tb.targetQty != null ? [{
      label: `Target Bonus ${tb.bonusPercent}%`,
      sub: `${tb.actualQty} / ${tb.targetQty} purchased`,
      earned: report.totals.bonusPercentEarned,
      pct: Math.min(100, (tb.actualQty / tb.targetQty) * 100),
      color: tb.eligible ? "#10b981" : "#3b82f6",
    }] : []),
    ...(report.totals.stockInEarned > 0 ? [{
      label: "Stock-In Earned",
      sub: "Regular stock purchased",
      earned: report.totals.stockInEarned,
      pct: 100,
      color: "#10b981",
    }] : []),
    ...report.dealerIncentives.filter((di) => di.targetTotal > 0).map((di) => ({
      label: "Dealer Incentive",
      sub: `${di.actualTotal} / ${di.targetTotal} activations`,
      earned: di.earned,
      pct: Math.min(100, (di.actualTotal / di.targetTotal) * 100),
      color: di.eligible ? "#10b981" : "#f59e0b",
    })),
    ...(report.totals.activationIncentiveEarned > 0 ? [{
      label: "Activation Incentive",
      sub: "Per-model policy",
      earned: report.totals.activationIncentiveEarned,
      pct: 100,
      color: "#f59e0b",
    }] : []),
    ...(rebateTotal > 0 ? [{
      label: "Price-Drop Rebates",
      sub: "Unsold stock at drop date",
      earned: rebateTotal,
      pct: 100,
      color: "#06b6d4",
    }] : []),
  ].filter((p) => p.earned > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Award className="size-3.5" /> Policy Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {policies.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">No active policies this period.</div>
        ) : (
          <div className="divide-y">
            {policies.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-medium">{p.label}</p>
                    <p className="shrink-0 text-[11px] font-semibold tabular-nums">{formatPKR(p.earned)}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${p.pct}%`, backgroundColor: p.color }}
                      />
                    </div>
                    <p className="shrink-0 text-[9px] text-muted-foreground">{p.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardClient({
  dealerName,
  initialFrom,
  initialTo,
  initialReport,
  initialModelSales,
  initialCrLoss,
  initialRebateTotal,
  sixMonths,
  stock,
  movedTo,
  pendingCount,
}: Props) {
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [layout, setLayout] = useState<Layout>("cards");
  const [report, setReport] = useState<IncentiveReport>(initialReport);
  const [modelSales, setModelSales] = useState<ModelSaleRow[]>(initialModelSales);
  const [crLoss, setCrLoss] = useState(initialCrLoss);
  const [rebateTotal, setRebateTotal] = useState(initialRebateTotal);
  const [pending, startTransition] = useTransition();

  const load = (f: string, t: string) => {
    startTransition(async () => {
      const data = await getDashboardPeriodAction(f, t);
      if (data) {
        setReport(data.report);
        setModelSales(data.modelSales);
        setCrLoss(data.crLoss);
        setRebateTotal(data.rebateTotal);
      }
    });
  };

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from: f, to: t } = presetRange(p);
      setFrom(f);
      setTo(t);
      load(f, t);
    }
  };

  const applyCustom = () => load(from, to);

  // Derived from current report state
  const tb = report.targetBonus;
  const modelsWithIncentive = new Set(
    report.rows.filter((r) => r.total > 0 || r.stockInEarned > 0).map((r) => r.modelId)
  );
  const incentiveRows = report.rows
    .filter((r) => r.total > 0 || r.stockInEarned > 0)
    .sort((a, b) => b.qtyActivated - a.qtyActivated);
  const totalModelSales = modelSales.reduce((s, r) => s + r.qty, 0);
  const label = periodLabel(from, to);

  const downloadCSV = () => {
    const lines: string[] = [
      `Dashboard Analytics — ${dealerName}`,
      `Period: ${from} to ${to}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
      "=== KPI Summary ===",
      "Metric,Value",
      `Active Phones,${report.totalActivations}`,
      `Base Incentive (${report.baseIncentivePercent}%),"${formatPKR(report.totals.basePercentEarned)}"`,
      `Target Bonus (${tb.bonusPercent}%),"${formatPKR(report.totals.bonusPercentEarned)}"`,
      `Stock-In Earned,"${formatPKR(report.totals.stockInEarned)}"`,
      `Activation Incentive,"${formatPKR(report.totals.activationIncentiveEarned)}"`,
      `Dealer Incentive,"${formatPKR(report.totals.dealerIncentiveEarned)}"`,
      `Total from OPPO,"${formatPKR(report.totals.grandTotal)}"`,
      `Price-Drop Rebates,"${formatPKR(rebateTotal)}"`,
      `Net Receivable from OPPO,"${formatPKR(report.totals.grandTotal + rebateTotal - crLoss.lostIncentive)}"`,
      `CR Caught Loss,"${formatPKR(crLoss.lostIncentive)}"`,
      `CR Caught Units,${crLoss.totalUnits}`,
      `Target Progress,"${tb.actualQty} / ${tb.targetQty ?? "—"}"`,
      `Target Met,${tb.eligible ? "Yes" : "No"}`,
      "",
      "=== Model-wise Sales ===",
      "Model,Units Sold,% of Total",
      ...modelSales.map((r) => {
        const pct = totalModelSales > 0 ? ((r.qty / totalModelSales) * 100).toFixed(1) : "0.0";
        return `"${r.modelName}",${r.qty},${pct}%`;
      }),
      `Total,${totalModelSales},100%`,
      "",
      "=== Incentive Models ===",
      "Model,Activated,Stocked,Base Earned,Bonus Earned,Stock-In Earned,Total",
      ...incentiveRows.map(
        (r) =>
          `"${r.modelName}",${r.qtyActivated},${r.stockInRegularQty},"${formatPKR(r.basePercentEarned)}","${formatPKR(r.bonusPercentEarned)}","${formatPKR(r.stockInEarned)}","${formatPKR(r.total)}"`
      ),
      "",
      "=== Current Stock ===",
      "Model,Quantity,Dealer Price",
      ...stock.map(
        (s) =>
          `"${s.modelName}",${s.quantity},"${s.dealerPrice != null ? formatPKR(s.dealerPrice) : "—"}"`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-${dealerName.replace(/\s+/g, "-")}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Shared section renderers ──────────────────────────────────────────────

  const kpiCards = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <KpiCard
        label="Active phones"
        value={report.totalActivations}
        icon={<Smartphone className="size-4" />}
      />
      <KpiCard
        label={`${report.baseIncentivePercent}% earned`}
        value={report.totals.basePercentEarned}
        format="currency"
        icon={<Percent className="size-4" />}
      />
      <KpiCard
        label={`Target bonus ${tb.bonusPercent}%`}
        value={report.totals.bonusPercentEarned}
        format="currency"
        icon={<Award className="size-4" />}
        highlightZero
        progress={tb.targetQty != null ? { current: tb.actualQty, target: tb.targetQty } : undefined}
        helper={
          tb.eligible
            ? "Purchase target met ✓"
            : `${tb.actualQty}/${tb.targetQty ?? "—"} purchased`
        }
      />
      <KpiCard
        label="Stock-In earned"
        value={report.totals.stockInEarned}
        format="currency"
        icon={<Truck className="size-4" />}
      />
      <KpiCard
        label="Total from OPPO"
        value={report.totals.grandTotal}
        format="currency"
        icon={<Wallet className="size-4" />}
      />
      <KpiCard
        label="Rebates receivable"
        value={rebateTotal}
        format="currency"
        icon={<RefreshCw className="size-4" />}
        helper={rebateTotal > 0 ? "Price-drop rebates" : "No rebates this period"}
      />
      <KpiCard
        label="CR Caught Loss"
        value={crLoss.lostIncentive}
        format="currency"
        icon={<ShieldAlert className="size-4" />}
        highlightZero
        helper={
          crLoss.totalUnits > 0
            ? `${crLoss.totalUnits} units caught`
            : "No catches this period"
        }
      />
    </div>
  );

  const stockSection = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="size-4" />
          Current Stock
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {stock.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No stock on hand.</div>
        ) : (
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {stock.map((s) => {
              const moved = movedTo[s.modelId];
              const hasIncentive = modelsWithIncentive.has(s.modelId);
              return (
                <div key={s.modelId} className="flex flex-col gap-1 bg-card p-3">
                  <span className="text-xs font-medium leading-tight truncate">{s.modelName}</span>
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {s.quantity}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {s.dealerPrice != null && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatPKR(s.dealerPrice)}
                      </span>
                    )}
                    {moved && (
                      <span className="flex items-center gap-0.5 text-[10px] text-blue-500">
                        <ArrowRight className="size-2.5" />
                        {moved.join(", ")}
                      </span>
                    )}
                    {!hasIncentive && (
                      <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">
                        no incentive
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const incentiveSection =
    incentiveRows.length > 0 ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incentive models — {label}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {incentiveRows.map((row) => (
              <div key={row.modelId} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{row.modelName}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.qtyActivated} activated · {row.stockInRegularQty} stocked
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium tabular-nums">{formatPKR(row.total)}</div>
                  <div className="text-xs text-muted-foreground">
                    {report.baseIncentivePercent}% {formatPKR(row.basePercentEarned)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ) : null;

  const modelSalesSection = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="size-4" />
          Model-wise Sales
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {modelSales.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No activations in this period.
          </div>
        ) : (
          <div className="divide-y">
            {modelSales.map((r) => {
              const pct = totalModelSales > 0 ? (r.qty / totalModelSales) * 100 : 0;
              return (
                <div key={r.modelId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-36 shrink-0 text-sm font-medium truncate">{r.modelName}</div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold tabular-nums">
                    {r.qty} sold
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground border-t">
              <span>{modelSales.length} model(s)</span>
              <span className="font-semibold text-foreground tabular-nums">
                {totalModelSales} total
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ── Layout renderers ──────────────────────────────────────────────────────

  const renderCards = () => {
    const totalStock = stock.reduce((s, st) => s + st.quantity, 0);
    const stockValue = stock.reduce((s, st) => s + (st.dealerPrice ?? 0) * st.quantity, 0);
    const topModel = modelSales[0];
    const crRegular = report.totalActivations - report.totalActivationsCrossRegion;
    const crRatio =
      report.totalActivations > 0
        ? (report.totalActivationsCrossRegion / report.totalActivations) * 100
        : 0;

    const earningsStreams = [
      { label: `Base ${report.baseIncentivePercent}%`, amount: report.totals.basePercentEarned },
      { label: `Bonus ${tb.bonusPercent}%`, amount: report.totals.bonusPercentEarned },
      { label: "Stock-In", amount: report.totals.stockInEarned },
      { label: "Activation Incentive", amount: report.totals.activationIncentiveEarned },
      { label: "Dealer Incentive", amount: report.totals.dealerIncentiveEarned },
      { label: "Price-Drop Rebates", amount: rebateTotal },
    ].filter((s) => s.amount > 0);
    const maxEarning = Math.max(...earningsStreams.map((s) => s.amount), 1);
    const streamColors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

    const topStockModels = [...stock].sort((a, b) => b.quantity - a.quantity).slice(0, 4);
    const maxStockQty = Math.max(...topStockModels.map((s) => s.quantity), 1);

    const progressPct =
      tb.targetQty != null ? Math.min(100, (tb.actualQty / tb.targetQty) * 100) : 0;

    const leaderRows = incentiveRows.slice(0, 6);
    const maxActivated = Math.max(...leaderRows.map((r) => r.qtyActivated), 1);

    const riskLevel =
      crLoss.totalUnits === 0 ? "none" : crLoss.totalUnits <= 3 ? "low" : "high";

    const bestMonth = sixMonths.reduce(
      (best, m) => (m.total > best.total ? m : best),
      sixMonths[0] ?? { label: "", total: 0, activations: 0 }
    );
    const avgMonthly =
      sixMonths.length > 0
        ? sixMonths.reduce((s, m) => s + m.total, 0) / sixMonths.length
        : 0;
    const chartData = sixMonths.map((m) => ({
      name: m.label,
      total: m.total,
      activations: m.activations,
      isBest: m.label === bestMonth?.label,
    }));

    return (
      <div className="space-y-4">
        {/* ── Row 1: Grand Total (2-wide) · Activation Performance · Target Bonus ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1 — Grand Total Incentive */}
          <Card className="lg:col-span-2 relative overflow-hidden border-primary/20">
            {/* Layered gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/4 to-transparent pointer-events-none" />
            <div className="absolute -top-12 -right-12 size-56 rounded-full bg-primary/6 blur-3xl pointer-events-none" />
            <div className="absolute bottom-6 -left-8 size-32 rounded-full bg-primary/4 blur-2xl pointer-events-none" />
            {/* Income stream color strip at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1 flex pointer-events-none">
              {earningsStreams.map((s, i) => {
                const pct = report.totals.grandTotal > 0 ? (s.amount / report.totals.grandTotal) * 100 : 0;
                const colors = ["#8b5cf6","#3b82f6","#10b981","#f59e0b","#ef4444"];
                return <div key={i} style={{ width: `${pct}%`, backgroundColor: colors[i] }} />;
              })}
            </div>
            <CardHeader className="pb-2 relative z-10">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Wallet className="size-3.5" /> Grand Total Incentive
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex items-start gap-6">
                {/* Left: total + waterfall bars */}
                <div className="flex-1 min-w-0 space-y-4">
                  <div>
                    <div className="text-4xl font-bold tabular-nums text-primary">
                      {formatPKR(report.totals.grandTotal)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: `Base ${report.baseIncentivePercent}%`, value: report.totals.basePercentEarned, color: "#8b5cf6" },
                      { label: `Target Bonus ${tb.bonusPercent}%`, value: report.totals.bonusPercentEarned, color: "#3b82f6" },
                      { label: "Stock-In Earned", value: report.totals.stockInEarned, color: "#10b981" },
                      { label: "Activation Incentive", value: report.totals.activationIncentiveEarned, color: "#f59e0b" },
                      { label: "Dealer Incentive", value: report.totals.dealerIncentiveEarned, color: "#ef4444" },
                      { label: "Price-Drop Rebates", value: rebateTotal, color: "#06b6d4" },
                    ].map((s) => {
                      const totalBase = report.totals.grandTotal + rebateTotal;
                      const pct = totalBase > 0 ? (s.value / totalBase) * 100 : 0;
                      return (
                        <div key={s.label} className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <div className="w-28 shrink-0 text-[11px] text-muted-foreground truncate">{s.label}</div>
                          <div className="flex-1 h-1.5 rounded-full bg-muted/70 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: s.color }}
                            />
                          </div>
                          <div className="w-24 text-right text-[11px] font-semibold tabular-nums">
                            {formatPKR(s.value)}
                          </div>
                        </div>
                      );
                    })}
                    {rebateTotal > 0 && (
                      <div className="flex items-center justify-between border-t pt-1.5">
                        <span className="text-[11px] font-semibold text-muted-foreground">Net receivable from OPPO</span>
                        <span className="text-[11px] font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
                          {formatPKR(report.totals.grandTotal + rebateTotal)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Right: donut chart */}
                <div className="relative shrink-0 hidden sm:flex items-center justify-center" style={{ width: 128, height: 128 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={earningsStreams.length > 0 ? earningsStreams : [{ label: "None", amount: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={58}
                        dataKey="amount"
                        strokeWidth={2}
                        stroke="hsl(var(--background))"
                      >
                        {(earningsStreams.length > 0 ? earningsStreams : [{ label: "None", amount: 1 }]).map((_, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={
                              earningsStreams.length === 0
                                ? "hsl(var(--muted))"
                                : (["#8b5cf6","#3b82f6","#10b981","#f59e0b","#ef4444","#06b6d4"])[idx % 6]
                            }
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[10px] font-medium text-muted-foreground">earned</div>
                    <div className="text-[11px] font-bold text-primary leading-tight">
                      {report.totals.grandTotal > 0
                        ? `${((report.totals.basePercentEarned / report.totals.grandTotal) * 100).toFixed(0)}% base`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2 — Activation Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Smartphone className="size-3.5" /> Activation Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-4xl font-bold tabular-nums">{report.totalActivations}</div>
                <div className="text-xs text-muted-foreground">total activations</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-xl font-bold tabular-nums">{crRegular}</div>
                  <div className="text-[10px] text-muted-foreground">Regular</div>
                </div>
                <div className="rounded-lg bg-blue-500/10 p-2 text-center">
                  <div className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                    {report.totalActivationsCrossRegion}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Cross-Region</div>
                </div>
              </div>
              {topModel && (
                <div className="rounded-lg border px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground shrink-0">Top model</span>
                  <span className="text-[11px] font-semibold truncate">{topModel.modelName}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{topModel.qty}</Badge>
                </div>
              )}
              {crRatio > 0 && (
                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-muted-foreground shrink-0">CR ratio</div>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${crRatio}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-medium shrink-0">{crRatio.toFixed(1)}%</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3 — Target Bonus Progress */}
          <Card className={tb.eligible ? "border-green-500/40" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Award className="size-3.5" /> Target Bonus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div
                  className={`text-4xl font-bold tabular-nums ${
                    tb.eligible ? "text-green-600 dark:text-green-400" : ""
                  }`}
                >
                  {formatPKR(report.totals.bonusPercentEarned)}
                </div>
                <div className="text-xs text-muted-foreground">{tb.bonusPercent}% bonus</div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{tb.actualQty} purchased</span>
                  <span>target: {tb.targetQty ?? "—"}</span>
                </div>
                {tb.targetQty != null && (
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        tb.eligible ? "bg-green-500" : "bg-primary"
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}
                <div className="text-center pt-0.5">
                  <Badge
                    variant={tb.eligible ? "default" : "secondary"}
                    className={`text-[11px] ${
                      tb.eligible ? "bg-green-500 hover:bg-green-500/90 text-white" : ""
                    }`}
                  >
                    {tb.eligible ? "✓ Target Met" : `${progressPct.toFixed(0)}% to goal`}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: Stock · Earnings · Leaderboard · CR Monitor ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 4 — Stock Intelligence */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Package className="size-3.5" /> Stock Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-3xl font-bold tabular-nums">{totalStock}</div>
                  <div className="text-[10px] text-muted-foreground">units on hand</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-xs font-bold tabular-nums leading-tight">{formatPKR(stockValue)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">stock value</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {topStockModels.map((s) => {
                  const pct = (s.quantity / maxStockQty) * 100;
                  return (
                    <div key={s.modelId} className="flex items-center gap-2">
                      <div className="w-20 text-[11px] truncate text-muted-foreground">{s.modelName}</div>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-6 text-right text-[11px] font-bold">{s.quantity}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-muted-foreground text-right">{stock.length} model(s) total</div>
            </CardContent>
          </Card>

          {/* Card 5 — Earnings Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Percent className="size-3.5" /> Earnings Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {earningsStreams.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">No earnings this period</div>
              ) : (
                earningsStreams.map((s, i) => {
                  const barPct = (s.amount / maxEarning) * 100;
                  const sharePct =
                    report.totals.grandTotal > 0
                      ? (s.amount / report.totals.grandTotal) * 100
                      : 0;
                  return (
                    <div key={s.label} className="space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-medium tabular-nums">{sharePct.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${streamColors[i % streamColors.length]}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <div className="w-20 text-right text-[10px] tabular-nums text-muted-foreground">
                          {formatPKR(s.amount)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Card 6 — Model Leaderboard */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <List className="size-3.5" /> Model Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              {leaderRows.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">No activations this period</div>
              ) : (
                leaderRows.map((row, i) => {
                  const pct = (row.qtyActivated / maxActivated) * 100;
                  return (
                    <div key={row.modelId} className="flex items-center gap-1.5">
                      <div className="w-4 text-[10px] font-bold text-muted-foreground shrink-0">
                        {i + 1}
                      </div>
                      <div className="w-[72px] text-[11px] truncate shrink-0">{row.modelName}</div>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-5 text-right text-[11px] font-bold shrink-0">
                        {row.qtyActivated}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Card 7a — Policy Progress */}
          <PolicyProgressCard report={report} rebateTotal={rebateTotal} />

          {/* Card 7 — CR Risk Monitor */}
          <Card className={crLoss.totalUnits > 3 ? "border-red-500/40" : crLoss.totalUnits > 0 ? "border-amber-500/40" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="size-3.5" /> CR Risk Monitor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    riskLevel === "none"
                      ? "bg-green-500"
                      : riskLevel === "low"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                />
                <span
                  className={`text-sm font-semibold ${
                    riskLevel === "none"
                      ? "text-green-600 dark:text-green-400"
                      : riskLevel === "low"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {riskLevel === "none" ? "No Risk" : riskLevel === "low" ? "Low Risk" : "High Risk"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-2xl font-bold tabular-nums">{crLoss.totalUnits}</div>
                  <div className="text-[10px] text-muted-foreground">units caught</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2 text-center">
                  <div className="text-xs font-bold tabular-nums">{formatPKR(crLoss.lostIncentive)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">est. loss</div>
                </div>
              </div>
              {pendingCount > 0 ? (
                <Link href="/cross-region">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center justify-between hover:bg-amber-500/10 transition-colors cursor-pointer">
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">Pending transfers</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-400"
                    >
                      {pendingCount}
                    </Badge>
                  </div>
                </Link>
              ) : (
                crLoss.totalUnits === 0 && (
                  <div className="text-[11px] text-muted-foreground text-center">
                    All clear — no catches this period
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Row 3: 6-Month Earnings Trend ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <TrendingUp className="size-3.5" /> 6-Month Earnings Trend
              </CardTitle>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {bestMonth && bestMonth.label && (
                  <span>
                    Best:{" "}
                    <span className="font-semibold text-foreground">
                      {bestMonth.label} — {formatPKR(bestMonth.total)}
                    </span>
                  </span>
                )}
                {avgMonthly > 0 && (
                  <span>
                    Monthly avg:{" "}
                    <span className="font-semibold text-foreground">{formatPKR(avgMonthly)}</span>
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sixMonths.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={32} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: "currentColor", opacity: 0.05 }}
                      content={({ active, payload, label: lbl }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload as typeof chartData[number];
                        return (
                          <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md space-y-0.5">
                            <div className="font-semibold">{lbl}</div>
                            <div className="text-muted-foreground">
                              {formatPKR(d.total)}
                            </div>
                            <div className="text-muted-foreground">
                              {d.activations} activations
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill="hsl(var(--primary))"
                          opacity={entry.isBest ? 1 : 0.35}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderCharts = () => (
    <div className="space-y-6">
      {/* Slim KPI strip */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "Phones", value: report.totalActivations, currency: false },
          { label: `${report.baseIncentivePercent}% earned`, value: report.totals.basePercentEarned, currency: true },
          { label: `Bonus ${tb.bonusPercent}%`, value: report.totals.bonusPercentEarned, currency: true },
          { label: "Stock-In", value: report.totals.stockInEarned, currency: true },
          { label: "Total", value: report.totals.grandTotal, currency: true },
          { label: "Rebates", value: rebateTotal, currency: true },
          { label: "CR Loss", value: crLoss.lostIncentive, currency: true },
        ].map((k) => (
          <Card key={k.label} className="p-3">
            <div className="text-[10px] text-muted-foreground truncate">{k.label}</div>
            <div className="text-sm font-semibold tabular-nums truncate">
              {k.currency ? formatPKR(k.value) : k.value.toLocaleString()}
            </div>
          </Card>
        ))}
      </div>
      <TrendCharts data={sixMonths} />
      {modelSalesSection}
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Performance Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-sm">
              {(
                [
                  ["Active Phones", report.totalActivations.toLocaleString(), false],
                  [`Base Incentive (${report.baseIncentivePercent}%)`, formatPKR(report.totals.basePercentEarned), false],
                  [`Target Bonus (${tb.bonusPercent}%)`, formatPKR(report.totals.bonusPercentEarned), false],
                  ["Stock-In Earned", formatPKR(report.totals.stockInEarned), false],
                  ["Activation Incentive", formatPKR(report.totals.activationIncentiveEarned), false],
                  ["Dealer Incentive", formatPKR(report.totals.dealerIncentiveEarned), false],
                  ["Total from OPPO", formatPKR(report.totals.grandTotal), false],
                  ["Price-Drop Rebates", formatPKR(rebateTotal), true],
                  ["CR Caught Loss", formatPKR(crLoss.lostIncentive), false],
                ] as [string, string, boolean][]
              ).map(([k, v, highlight]) => (
                <div key={k} className="flex justify-between px-4 py-2.5">
                  <span className={highlight ? "text-cyan-700 dark:text-cyan-400 font-medium" : "text-muted-foreground"}>{k}</span>
                  <span className={`font-medium tabular-nums ${highlight ? "text-cyan-700 dark:text-cyan-400" : ""}`}>{v}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Target Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-4xl font-bold tabular-nums">{tb.actualQty}</div>
              <div className="text-sm text-muted-foreground">
                of {tb.targetQty ?? "—"} purchased
              </div>
            </div>
            {tb.targetQty != null && (
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (tb.actualQty / tb.targetQty) * 100)}%` }}
                />
              </div>
            )}
            <p className="text-center text-sm text-muted-foreground">
              {tb.eligible ? "✓ Purchase target met" : "Purchase target not yet met"}
            </p>
            {crLoss.totalUnits > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xs text-muted-foreground">CR Caught Loss</div>
                <div className="text-lg font-semibold">{crLoss.totalUnits} units</div>
                <div className="text-xs text-muted-foreground">
                  {formatPKR(crLoss.lostIncentive)} est. loss
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {incentiveSection}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {stockSection}
        {modelSalesSection}
      </div>
    </div>
  );

  const renderCompact = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard
          label="Active phones"
          value={report.totalActivations}
          icon={<Smartphone className="size-4" />}
        />
        <KpiCard
          label={`${report.baseIncentivePercent}% earned`}
          value={report.totals.basePercentEarned}
          format="currency"
          icon={<Percent className="size-4" />}
        />
        <KpiCard
          label={`Target ${tb.bonusPercent}%`}
          value={report.totals.bonusPercentEarned}
          format="currency"
          icon={<Award className="size-4" />}
          highlightZero
          progress={tb.targetQty != null ? { current: tb.actualQty, target: tb.targetQty } : undefined}
          helper={tb.eligible ? "Target met ✓" : `${tb.actualQty}/${tb.targetQty ?? "—"}`}
        />
        <KpiCard
          label="Stock-In"
          value={report.totals.stockInEarned}
          format="currency"
          icon={<Truck className="size-4" />}
        />
        <KpiCard
          label="Total"
          value={report.totals.grandTotal}
          format="currency"
          icon={<Wallet className="size-4" />}
        />
        <KpiCard
          label="Rebates"
          value={rebateTotal}
          format="currency"
          icon={<RefreshCw className="size-4" />}
          helper={rebateTotal > 0 ? "Price-drop rebates" : "No rebates"}
        />
        <KpiCard
          label="CR Loss"
          value={crLoss.lostIncentive}
          format="currency"
          icon={<ShieldAlert className="size-4" />}
          highlightZero
          helper={crLoss.totalUnits > 0 ? `${crLoss.totalUnits} caught` : "No catches"}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Incentive Models
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {incentiveRows.length === 0 ? (
              <div className="px-4 pb-4 text-xs text-muted-foreground">
                No incentive earned this period.
              </div>
            ) : (
              <div className="divide-y">
                {incentiveRows.map((row) => (
                  <div key={row.modelId} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <div className="text-xs font-medium">{row.modelName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {row.qtyActivated} act · {row.stockInRegularQty} stk
                      </div>
                    </div>
                    <div className="text-xs font-semibold tabular-nums">
                      {formatPKR(row.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Current Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stock.length === 0 ? (
              <div className="px-4 pb-4 text-xs text-muted-foreground">No stock on hand.</div>
            ) : (
              <div className="divide-y">
                {stock.map((s) => (
                  <div key={s.modelId} className="flex items-center justify-between px-4 py-2">
                    <span className="text-xs font-medium truncate">{s.modelName}</span>
                    <span className="text-sm font-bold tabular-nums">{s.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {modelSalesSection}
    </div>
  );

  // ── Financial layout ────────────────────────────────────────────────────────
  const renderFinancial = () => {
    const streams = [
      { label: `Base Incentive (${report.baseIncentivePercent}%)`, amount: report.totals.basePercentEarned, note: `${report.totalActivations} activations` },
      { label: `Target Bonus (${tb.bonusPercent}%)`, amount: report.totals.bonusPercentEarned, note: tb.eligible ? "Target met" : "Target not met" },
      { label: "Stock-In Earned", amount: report.totals.stockInEarned, note: `${report.rows.reduce((s, r) => s + r.stockInRegularQty, 0)} units stocked` },
      { label: "Activation Incentive", amount: report.totals.activationIncentiveEarned, note: "Per-activation bonus" },
      { label: "Dealer Incentive", amount: report.totals.dealerIncentiveEarned, note: "Dealer program bonus" },
    ].filter((s) => s.amount > 0);
    const netTotal = report.totals.grandTotal + rebateTotal - crLoss.lostIncentive;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Income statement */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="size-4" /> Income Statement — {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-4 py-2 bg-muted/40 border-b">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Gross Earnings</div>
              </div>
              {streams.map((s) => (
                <div key={s.label} className="flex items-center justify-between px-6 py-2.5 border-b last:border-b-0">
                  <div>
                    <div className="text-sm">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">{s.note}</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatPKR(s.amount)}</div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t-2">
                <div className="font-semibold text-sm">Gross Total</div>
                <div className="font-bold tabular-nums">{formatPKR(report.totals.grandTotal)}</div>
              </div>
              {rebateTotal > 0 && (
                <>
                  <div className="px-4 py-2 bg-cyan-50/60 dark:bg-cyan-950/20 border-t border-b border-cyan-200 dark:border-cyan-800">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-700 dark:text-cyan-400">Receivables (Owed by OPPO)</div>
                  </div>
                  <div className="flex items-center justify-between px-6 py-2.5 border-b bg-cyan-50/40 dark:bg-cyan-950/10">
                    <div>
                      <div className="text-sm text-cyan-700 dark:text-cyan-400">Price-Drop Rebates</div>
                      <div className="text-[10px] text-muted-foreground">Stock on hand × price reduction</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-cyan-700 dark:text-cyan-400">
                      +{formatPKR(rebateTotal)}
                    </div>
                  </div>
                </>
              )}
              {crLoss.lostIncentive > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/40 border-t border-b">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Deductions</div>
                  </div>
                  <div className="flex items-center justify-between px-6 py-2.5 border-b">
                    <div>
                      <div className="text-sm text-red-600 dark:text-red-400">CR Caught Loss</div>
                      <div className="text-[10px] text-muted-foreground">{crLoss.totalUnits} units caught cross-region</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
                      −{formatPKR(crLoss.lostIncentive)}
                    </div>
                  </div>
                </>
              )}
              {(rebateTotal > 0 || crLoss.lostIncentive > 0) && (
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t-2">
                  <div className="font-semibold text-sm">Net Receivable from OPPO</div>
                  <div className="font-bold tabular-nums text-primary">{formatPKR(netTotal)}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side: target + activations */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">Target Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <div className="text-4xl font-bold tabular-nums">{tb.actualQty}</div>
                  <div className="text-xs text-muted-foreground">of {tb.targetQty ?? "—"} units</div>
                </div>
                {tb.targetQty != null && (
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${tb.eligible ? "bg-green-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, (tb.actualQty / tb.targetQty) * 100)}%` }}
                    />
                  </div>
                )}
                <div className="text-center">
                  <Badge variant={tb.eligible ? "default" : "secondary"} className={tb.eligible ? "bg-green-500 text-white" : ""}>
                    {tb.eligible ? "✓ Target Met" : "In Progress"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">Activations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold tabular-nums text-center">{report.totalActivations}</div>
                {report.totalActivationsCrossRegion > 0 && (
                  <div className="text-xs text-muted-foreground text-center mt-1">
                    {report.totalActivationsCrossRegion} cross-region
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Model earnings table */}
        {incentiveRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Model Earnings Detail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-muted/30 border-b text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <div className="col-span-2">Model</div>
                <div className="text-center">Activated</div>
                <div className="text-center">Stocked</div>
                <div className="text-right">Earned</div>
              </div>
              {incentiveRows.map((row) => (
                <div key={row.modelId} className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b last:border-b-0 text-sm">
                  <div className="col-span-2 font-medium truncate">{row.modelName}</div>
                  <div className="text-center tabular-nums">{row.qtyActivated}</div>
                  <div className="text-center tabular-nums">{row.stockInRegularQty}</div>
                  <div className="text-right font-semibold tabular-nums">{formatPKR(row.total)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ── Performance layout ───────────────────────────────────────────────────────
  const renderPerformance = () => {
    const totalStockVal = stock.reduce((s, st) => s + (st.dealerPrice ?? 0) * st.quantity, 0);
    const totalStockUnits = stock.reduce((s, st) => s + st.quantity, 0);
    const progPct = tb.targetQty != null ? Math.min(100, (tb.actualQty / tb.targetQty) * 100) : 0;

    return (
      <div className="space-y-4">
        {/* 4 hero blocks */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
            <CardContent className="p-6">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Grand Total Incentive</div>
              <div className="text-5xl font-black tabular-nums text-primary mt-2 leading-none">{formatPKR(report.totals.grandTotal)}</div>
              <div className="text-xs text-muted-foreground mt-2">{label}</div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total Activations</div>
              <div className="text-5xl font-black tabular-nums mt-2 leading-none">{report.totalActivations}</div>
              <div className="text-xs text-muted-foreground mt-2">
                {report.totalActivationsCrossRegion} cross-region · {report.totalActivations - report.totalActivationsCrossRegion} regular
              </div>
            </CardContent>
          </Card>
          <Card className={`relative overflow-hidden ${tb.eligible ? "border-green-500/40" : ""}`}>
            <CardContent className="p-6">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Target Bonus Progress</div>
              <div className={`text-5xl font-black tabular-nums mt-2 leading-none ${tb.eligible ? "text-green-600 dark:text-green-400" : ""}`}>
                {tb.targetQty != null ? `${progPct.toFixed(0)}%` : "—"}
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${tb.eligible ? "bg-green-500" : "bg-primary"}`} style={{ width: `${progPct}%` }} />
              </div>
              <div className="text-xs text-muted-foreground mt-1.5">{tb.actualQty} / {tb.targetQty ?? "—"} purchased · {formatPKR(report.totals.bonusPercentEarned)} earned</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Stock Portfolio Value</div>
              <div className="text-3xl font-black tabular-nums mt-2 leading-none">{formatPKR(totalStockVal)}</div>
              <div className="text-xs text-muted-foreground mt-2">{totalStockUnits} units · {stock.length} model(s)</div>
            </CardContent>
          </Card>
        </div>

        {/* Model performance bars */}
        {modelSales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Smartphone className="size-4" /> Activation Performance by Model
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {modelSales.slice(0, 8).map((r, i) => {
                const pct = totalModelSales > 0 ? (r.qty / totalModelSales) * 100 : 0;
                return (
                  <div key={r.modelId} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
                    <div className="w-5 text-sm font-bold text-muted-foreground shrink-0">{i + 1}</div>
                    <div className="w-36 text-sm font-medium truncate shrink-0">{r.modelName}</div>
                    <div className="flex-1">
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="w-10 text-right text-sm font-bold tabular-nums shrink-0">{r.qty}</div>
                    <div className="w-12 text-right text-xs text-muted-foreground shrink-0">{pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ── Timeline layout ──────────────────────────────────────────────────────────
  const renderTimeline = () => {
    if (sixMonths.length === 0) {
      return (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">No monthly data available.</CardContent>
        </Card>
      );
    }

    const maxMonthTotal = Math.max(...sixMonths.map((m) => m.total), 1);
    const totalEarned = sixMonths.reduce((s, m) => s + m.total, 0);
    const avgMonthly = totalEarned / sixMonths.length;
    const bestMonthObj = sixMonths.reduce(
      (best, m) => (m.total > best.total ? m : best),
      sixMonths[0]
    );

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">6-Month Total</div>
            <div className="text-xl font-bold tabular-nums mt-1">{formatPKR(totalEarned)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Monthly Average</div>
            <div className="text-xl font-bold tabular-nums mt-1">{formatPKR(avgMonthly)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Best Month</div>
            <div className="text-xl font-bold mt-1">{bestMonthObj.label}</div>
            <div className="text-xs text-muted-foreground">{formatPKR(bestMonthObj.total)}</div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="size-4" /> Month-by-Month Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {[...sixMonths].reverse().map((m) => {
              const pct = (m.total / maxMonthTotal) * 100;
              const isBest = m.label === bestMonthObj.label;
              const isAboveAvg = m.total >= avgMonthly;
              return (
                <div key={m.label} className={`border-b last:border-b-0 ${isBest ? "bg-primary/4" : ""}`}>
                  <div className="flex items-center gap-4 px-4 py-3">
                    <div className="w-20 shrink-0">
                      <div className="text-sm font-semibold">{m.label}</div>
                      {isBest && (
                        <Badge className="text-[9px] px-1.5 py-0 mt-0.5 bg-primary">Best</Badge>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="h-5 rounded-md bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-md transition-all ${isBest ? "bg-primary" : "bg-primary/40"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-32 text-right shrink-0">
                      <div className="text-sm font-bold tabular-nums">{formatPKR(m.total)}</div>
                      <div className="text-[10px] text-muted-foreground">{m.activations} activations</div>
                    </div>
                    <div className="w-14 text-right shrink-0">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] ${isAboveAvg ? "bg-green-500/15 text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                      >
                        {isAboveAvg ? "↑ avg" : "↓ avg"}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ── Executive layout ─────────────────────────────────────────────────────────
  const renderExecutive = () => {
    const totalStockUnits = stock.reduce((s, st) => s + st.quantity, 0);

    return (
      <div className="space-y-4">
        {/* Hero banner */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-primary/14 via-primary/6 to-transparent">
          <div className="absolute -top-8 -right-8 size-48 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
          <CardContent className="p-6 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">{dealerName}</div>
                <div className="text-5xl font-black tabular-nums text-primary mt-1 leading-none">
                  {formatPKR(report.totals.grandTotal)}
                </div>
                <div className="text-sm text-muted-foreground mt-2">Total incentive earned · {label}</div>
              </div>
              <div className="flex flex-col items-start md:items-end gap-2">
                <Badge
                  variant={tb.eligible ? "default" : "secondary"}
                  className={`text-sm px-4 py-1.5 ${tb.eligible ? "bg-green-500 hover:bg-green-500/90 text-white" : ""}`}
                >
                  {tb.eligible ? "✓ Purchase Target Met" : "Target Not Yet Met"}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {report.totalActivations} activations · {totalStockUnits} units in stock
                </div>
                {crLoss.totalUnits > 0 && (
                  <div className="text-xs text-red-500 font-medium">{crLoss.totalUnits} cross-region unit(s) caught</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key metrics strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Base Incentive", value: formatPKR(report.totals.basePercentEarned), sub: `${report.baseIncentivePercent}% rate`, variant: "default" as const },
            { label: "Target Bonus", value: formatPKR(report.totals.bonusPercentEarned), sub: `${tb.bonusPercent}% bonus rate`, variant: "default" as const },
            { label: "Stock-In Earned", value: formatPKR(report.totals.stockInEarned), sub: "Inventory incentive", variant: "default" as const },
            { label: "Rebates Receivable", value: formatPKR(rebateTotal), sub: "Price-drop rebates from OPPO", variant: "rebate" as const },
            { label: "CR Risk Loss", value: formatPKR(crLoss.lostIncentive), sub: `${crLoss.totalUnits} unit(s) caught`, variant: "danger" as const },
          ].map((k) => (
            <Card
              key={k.label}
              className={`p-4 ${k.variant === "danger" ? "border-red-500/30" : k.variant === "rebate" ? "border-cyan-500/30 bg-cyan-50/40 dark:bg-cyan-950/10" : ""}`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{k.label}</div>
              <div className={`text-xl font-bold tabular-nums mt-1 ${k.variant === "danger" ? "text-red-600 dark:text-red-400" : k.variant === "rebate" ? "text-cyan-700 dark:text-cyan-400" : ""}`}>
                {k.value}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* Model performance + stock */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activated Models — {label}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {modelSales.length === 0 ? (
                <div className="px-4 pb-4 text-xs text-muted-foreground">No activations this period.</div>
              ) : (
                modelSales.slice(0, 7).map((r, i) => {
                  const pct = totalModelSales > 0 ? (r.qty / totalModelSales) * 100 : 0;
                  return (
                    <div key={r.modelId} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0">
                      <div className="w-4 text-xs text-muted-foreground font-bold shrink-0">{i + 1}</div>
                      <div className="flex-1 text-sm truncate">{r.modelName}</div>
                      <div className="w-20 shrink-0">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-sm font-bold tabular-nums w-8 text-right shrink-0">{r.qty}</div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Stock on Hand</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {stock.length === 0 ? (
                <div className="px-4 pb-4 text-xs text-muted-foreground">No stock.</div>
              ) : (
                stock.slice(0, 7).map((s) => (
                  <div key={s.modelId} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0">
                    <div className="text-sm truncate">{s.modelName}</div>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.dealerPrice != null && (
                        <div className="text-xs text-muted-foreground tabular-nums">{formatPKR(s.dealerPrice)}</div>
                      )}
                      <div className="text-sm font-bold tabular-nums w-8 text-right">{s.quantity}</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const layoutContent = {
    cards: renderCards,
    charts: renderCharts,
    overview: renderOverview,
    compact: renderCompact,
    financial: renderFinancial,
    performance: renderPerformance,
    timeline: renderTimeline,
    executive: renderExecutive,
  }[layout]();

  return (
    <div className="space-y-4">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            <strong>{dealerName}</strong> — {label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Link href="/cross-region">
              <Badge variant="outline" className="gap-1">
                <ArrowLeftRight className="size-3" />
                {pendingCount} pending cross-region
              </Badge>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5">
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Controls: date filter + layout switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-2">
          {(["month", "week", "today", "custom"] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                preset === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p === "month"
                ? "This Month"
                : p === "week"
                ? "This Week"
                : p === "today"
                ? "Today"
                : "Custom"}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <Button size="sm" className="h-7 text-xs" onClick={applyCustom}>
                Apply
              </Button>
            </div>
          )}
          {pending && (
            <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
          )}
        </div>

        {/* Layout switcher */}
        <div className="flex items-center gap-0.5 rounded-lg border p-1">
          {LAYOUTS.map(({ id, icon: Icon, label: lbl }) => (
            <button
              key={id}
              onClick={() => setLayout(id)}
              title={lbl}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                layout === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{lbl}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Dashboard content ── */}
      <div className={pending ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
        {layoutContent}
      </div>
    </div>
  );
}

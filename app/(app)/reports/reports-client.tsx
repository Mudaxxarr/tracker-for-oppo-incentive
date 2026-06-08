"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  FileBarChart2,
  FileSpreadsheet,
  ChevronDown,
  TrendingUp,
  Smartphone,
  Wallet,
  RefreshCw,
  ShieldAlert,
  Truck,
  Award,
  CircleCheck,
  CircleX,
  ArrowUpRight,
  BookOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { IncentiveReport } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "@/lib/report-types";
import type { CrShiftedValueResult } from "@/lib/db/queries/purchases";
import type { RebateRow } from "@/lib/db/queries/rebates";
import {
  FilterBarPremium,
  ReportSectionPremium,
} from "@/components/feature/reports-premium";

export type { PolicyAchievementEntry };

interface DealerOpt {
  id: string;
  name: string;
}

interface CrCaughtLoss {
  totalUnits: number;
  lostIncentive: number;
  totalFines: number;
  priceUnitSum: number;
}

interface ReportEntry {
  dealerId: string;
  dealerName: string;
  report: IncentiveReport;
  policies: PolicyAchievementEntry[];
  crCaughtLoss: CrCaughtLoss;
  crShiftedValue: CrShiftedValueResult;
  rebateTotal: number;
  rebateRows: RebateRow[];
}

interface Props {
  dealers: DealerOpt[];
  initialDealerIds: string[];
  initialStart: string;
  initialEnd: string;
  reports: ReportEntry[];
}

function getMonthRange(offset: number) {
  const PKT = 5 * 3600 * 1000;
  const todayPKT = new Date(Date.now() + PKT);
  const [yr, mo] = todayPKT.toISOString().slice(0, 7).split("-").map(Number);
  const raw = mo + offset;
  const adjMo = ((raw - 1 + 120) % 12) + 1;
  const adjYr = yr + Math.floor((raw - 1) / 12);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${adjYr}-${pad(adjMo)}-01`,
    end: `${adjYr}-${pad(adjMo)}-${pad(new Date(Date.UTC(adjYr, adjMo, 0)).getUTCDate())}`,
  };
}

export function ReportsClient({
  dealers,
  initialDealerIds,
  initialStart,
  initialEnd,
  reports,
}: Props) {
  const router = useRouter();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [selected, setSelected] = useState<string[]>(initialDealerIds);
  const [discrepancyByDealer, setDiscrepancyByDealer] = useState<Record<string, string>>({});
  const [pdfTheme, setPdfTheme] = useState<"naval" | "arctic">("naval");
  const [premiumView, setPremiumView] = useState(false);
  const [isPending, startTransition] = useTransition();

  const apply = () => {
    const sp = new URLSearchParams();
    sp.set("periodStart", start);
    sp.set("periodEnd", end);
    if (selected.length > 0) sp.set("dealerIds", selected.join(","));
    startTransition(() => { router.replace(`/reports?${sp.toString()}`); });
  };

  const setPreset = (label: "this" | "last") => {
    const { start: s, end: e } = getMonthRange(label === "this" ? 0 : -1);
    setStart(s);
    setEnd(e);
  };

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const exportLink = (
    entry: ReportEntry,
    format: string,
    skipNoIncentive = false
  ) => {
    const sp = new URLSearchParams({
      dealerId: entry.dealerId,
      periodStart: start,
      periodEnd: end,
      format,
      theme: pdfTheme,
    });
    if (skipNoIncentive) sp.set("skipNoIncentive", "1");
    return `/api/report?${sp.toString()}`;
  };

  const sharedDownloads = (entry: ReportEntry) => [
    { label: "Monthly Ledger", icon: "pdf" as const, href: exportLink(entry, "ledger-pdf"), featured: true },
    { label: "Dealer Statement", icon: "pdf" as const, href: exportLink(entry, "brief-pdf") },
    { label: "Summary Report", icon: "pdf" as const, href: exportLink(entry, "pdf") },
    { label: "Analytics Report", icon: "pdf" as const, href: exportLink(entry, "analytics-pdf") },
    { label: "Detailed Breakup", icon: "pdf" as const, href: exportLink(entry, "detailed-pdf") },
    { label: "Excel (Full)", icon: "xlsx" as const, href: exportLink(entry, "xlsx") },
    { label: "Excel (Incentive models)", icon: "xlsx" as const, href: exportLink(entry, "xlsx", true) },
  ];

  return (
    <div className={cn(
      "space-y-6 transition-all duration-500",
      premiumView && "-mx-3 md:-mx-6 -my-4 md:-my-6 px-3 md:px-6 py-4 md:py-6 bg-[#F7F6F3]"
    )}>
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-semibold transition-colors duration-300", premiumView && "text-white")}>Reports</h1>
          <p className={cn("text-sm transition-colors duration-300", premiumView ? "text-zinc-600" : "text-muted-foreground")}>
            Forensic audit view. Compare what the engine calculated against OPPO&apos;s ledger.
          </p>
        </div>
        <button
          onClick={() => setPremiumView((v) => !v)}
          className={cn(
            "group shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            premiumView
              ? "bg-[#111111] text-white hover:bg-[#333333]"
              : "border border-[#EAEAEA] bg-white text-[#787774] hover:border-[#AAAAAA] hover:text-[#111111]"
          )}
        >
          <svg viewBox="0 0 16 16" className="size-3.5 fill-current transition-transform duration-300 group-hover:scale-110">
            <path d="M8 0L9.8 5.6H16L10.9 8.8L12.7 14.4L8 11.2L3.3 14.4L5.1 8.8L0 5.6H6.2Z" />
          </svg>
          {premiumView ? "Standard View" : "Premium View"}
        </button>
      </div>

      {/* ── Filter Bar ── */}
      {premiumView ? (
        <FilterBarPremium
          start={start}
          end={end}
          dealers={dealers}
          selected={selected}
          isPending={isPending}
          onStartChange={setStart}
          onEndChange={setEnd}
          onToggleDealer={toggle}
          onPreset={setPreset}
          onApply={apply}
        />
      ) : (
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 tracking-tight">Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Start</label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">End</label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border-slate-200" />
              </div>
              <div className="inline-flex items-center rounded-xl bg-slate-100 p-1">
                <button onClick={() => setPreset("this")} className="rounded-lg px-3 py-1 text-xs font-medium text-slate-500 transition-all duration-200 hover:text-slate-700">This Month</button>
                <button onClick={() => setPreset("last")} className="rounded-lg px-3 py-1 text-xs font-medium text-slate-500 transition-all duration-200 hover:text-slate-700">Last Month</button>
              </div>
              <div className="ml-auto">
                <Button onClick={apply} disabled={isPending} className="transition-all duration-200 min-w-[90px]">
                  {isPending ? <RefreshCw className="size-3.5 animate-spin" /> : "Generate"}
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {dealers.map((d) => (
                <button key={d.id} onClick={() => toggle(d.id)}
                  className={`rounded-lg border px-3 py-1 text-xs font-medium transition-all duration-200 ${
                    selected.includes(d.id) ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty State ── */}
      {reports.length === 0 && (
        premiumView ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-10 text-center text-sm text-slate-400 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            Select at least one Dealer ID and click Generate.
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Select at least one Dealer ID and click Generate.
            </CardContent>
          </Card>
        )
      )}

      {/* ── Report Sections ── */}
      {reports.map((entry) =>
        premiumView ? (
          <ReportSectionPremium
            key={entry.dealerId}
            dealerName={entry.dealerName}
            report={entry.report}
            policies={entry.policies}
            crCaughtLoss={entry.crCaughtLoss}
            crShiftedValue={entry.crShiftedValue}
            rebateTotal={entry.rebateTotal}
            rebateRows={entry.rebateRows}
            discrepancy={discrepancyByDealer[entry.dealerId] ?? ""}
            onDiscrepancy={(v) => setDiscrepancyByDealer((prev) => ({ ...prev, [entry.dealerId]: v }))}
            pdfTheme={pdfTheme}
            onThemeChange={setPdfTheme}
            downloads={sharedDownloads(entry)}
          />
        ) : (
          <ReportSection
            key={entry.dealerId}
            dealerName={entry.dealerName}
            report={entry.report}
            policies={entry.policies}
            crCaughtLoss={entry.crCaughtLoss}
            crShiftedValue={entry.crShiftedValue}
            rebateTotal={entry.rebateTotal}
            rebateRows={entry.rebateRows}
            discrepancy={discrepancyByDealer[entry.dealerId] ?? ""}
            onDiscrepancy={(v) => setDiscrepancyByDealer((prev) => ({ ...prev, [entry.dealerId]: v }))}
            pdfTheme={pdfTheme}
            onThemeChange={setPdfTheme}
            downloads={sharedDownloads(entry)}
          />
        )
      )}
    </div>
  );
}

interface DownloadItem {
  label: string;
  icon: "pdf" | "xlsx";
  href: string;
  featured?: boolean;
}

function ReportSection({
  dealerName,
  report,
  policies,
  crCaughtLoss,
  crShiftedValue,
  rebateTotal,
  rebateRows,
  discrepancy,
  onDiscrepancy,
  downloads,
  pdfTheme,
  onThemeChange,
}: {
  dealerName: string;
  report: IncentiveReport;
  policies: PolicyAchievementEntry[];
  crCaughtLoss: CrCaughtLoss;
  crShiftedValue: CrShiftedValueResult;
  rebateTotal: number;
  rebateRows: RebateRow[];
  discrepancy: string;
  onDiscrepancy: (v: string) => void;
  downloads: DownloadItem[];
  pdfTheme: "naval" | "arctic";
  onThemeChange: (t: "naval" | "arctic") => void;
}) {
  const tb = report.targetBonus;
  const oppoLedger = Number(discrepancy.replace(/[^\d.-]/g, "")) || 0;
  const delta = oppoLedger - report.totals.grandTotal;
  const netReceivable = report.totals.grandTotal + rebateTotal - crCaughtLoss.totalFines;
  const totalStockedUnits = report.rows.reduce((s, r) => s + r.stockInRegularQty, 0);

  const earningStreams = [
    { label: `Base ${report.baseIncentivePercent}%`, value: report.totals.basePercentEarned, color: "#8b5cf6", icon: <TrendingUp className="size-3" /> },
    { label: `Target Bonus ${tb.bonusPercent}%`, value: report.totals.bonusPercentEarned, color: "#3b82f6", icon: <Award className="size-3" /> },
    { label: "Stock-In Earned", value: report.totals.stockInEarned, color: "#10b981", icon: <Truck className="size-3" /> },
    { label: "Activation Incentive", value: report.totals.activationIncentiveEarned, color: "#f59e0b", icon: <Smartphone className="size-3" /> },
    { label: "Dealer Incentive", value: report.totals.dealerIncentiveEarned, color: "#ef4444", icon: <Wallet className="size-3" /> },
  ].filter((s) => s.value > 0);

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">{dealerName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {report.totalActivations} activation{report.totalActivations !== 1 ? "s" : ""} ·{" "}
              {totalStockedUnits} unit{totalStockedUnits !== 1 ? "s" : ""} stocked
              {report.totalActivationsCrossRegion > 0 && ` · ${report.totalActivationsCrossRegion} cross-region`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <FileBarChart2 className="size-4" />
              Download
              <ChevronDown className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {/* Theme toggle */}
              <div className="px-2 py-2 flex items-center gap-2">
                <span className="text-[11px] font-medium tracking-tight text-muted-foreground/70 shrink-0">Theme</span>
                <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 text-xs">
                  <button
                    onClick={() => onThemeChange("naval")}
                    className={cn("rounded-md px-2.5 py-1 font-medium transition-all duration-200", pdfTheme === "naval" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  >
                    Naval
                  </button>
                  <button
                    onClick={() => onThemeChange("arctic")}
                    className={cn("rounded-md px-2.5 py-1 font-medium transition-all duration-200", pdfTheme === "arctic" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  >
                    Arctic
                  </button>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[11px] font-medium tracking-tight text-muted-foreground/70">PDF</DropdownMenuLabel>
                {downloads.filter((d) => d.icon === "pdf").map((d) => (
                  <DropdownMenuItem key={d.href} onClick={() => window.open(d.href, "_blank")} className={d.featured ? "font-semibold" : ""}>
                    {d.featured
                      ? <BookOpen className="size-3.5 shrink-0 text-blue-600" />
                      : <FileBarChart2 className="size-3.5 shrink-0 text-rose-500" />
                    }
                    {d.label}
                    {d.featured && <span className="ml-auto text-[10px] text-blue-500 font-normal">New</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[11px] font-medium tracking-tight text-muted-foreground/70">Excel</DropdownMenuLabel>
                {downloads.filter((d) => d.icon === "xlsx").map((d) => (
                  <DropdownMenuItem key={d.href} onClick={() => window.open(d.href, "_blank")}>
                    <FileSpreadsheet className="size-3.5 shrink-0 text-emerald-600" />
                    {d.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CardContent className="space-y-6 pt-5">
        {/* ── Financial Summary: 3 hero totals ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Gross earnings */}
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <div className="text-xs font-medium tracking-tight text-muted-foreground/70">Gross from OPPO</div>
            <div className="text-3xl font-black tabular-nums text-primary">
              {formatPKR(report.totals.grandTotal)}
            </div>
            {earningStreams.length > 0 && (
              <div className="flex h-1.5 overflow-hidden rounded-full mt-2">
                {earningStreams.map((s, i) => {
                  const pct = (s.value / report.totals.grandTotal) * 100;
                  return <div key={i} style={{ width: `${pct}%`, backgroundColor: s.color }} />;
                })}
              </div>
            )}
          </div>

          {/* Rebates receivable */}
          <div className={`rounded-xl border p-4 space-y-1 ${rebateTotal > 0 ? "border-cyan-300 bg-cyan-50/60 dark:border-cyan-700 dark:bg-cyan-950/20" : "bg-muted/20"}`}>
            <div className="text-xs font-medium tracking-tight text-muted-foreground/70">Rebates Receivable</div>
            <div className={`text-3xl font-black tabular-nums ${rebateTotal > 0 ? "text-cyan-700 dark:text-cyan-400" : "text-muted-foreground/50"}`}>
              {rebateTotal > 0 ? formatPKR(rebateTotal) : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {rebateRows.length > 0
                ? `${rebateRows.length} price-drop event${rebateRows.length > 1 ? "s" : ""}`
                : "No price drops this period"}
            </div>
          </div>

          {/* Net receivable */}
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-1">
            <div className="text-xs font-medium tracking-tight text-muted-foreground/70">Net Receivable</div>
            <div className="text-3xl font-black tabular-nums text-primary">
              {formatPKR(netReceivable)}
            </div>
            {(rebateTotal > 0 || crCaughtLoss.totalFines > 0) ? (
              <div className="text-[11px] tabular-nums space-y-0.5 pt-0.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Incentives</span>
                  <span>{formatPKR(report.totals.grandTotal)}</span>
                </div>
                {rebateTotal > 0 && (
                  <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400 font-medium">
                    <span>+ Rebates</span>
                    <span>{formatPKR(rebateTotal)}</span>
                  </div>
                )}
                {crCaughtLoss.totalFines > 0 && (
                  <div className="flex items-center justify-between text-red-500 font-medium">
                    <span>− CR Fines</span>
                    <span>−{formatPKR(crCaughtLoss.totalFines)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground">
                {crCaughtLoss.totalUnits > 0
                  ? `${crCaughtLoss.totalUnits} unit${crCaughtLoss.totalUnits !== 1 ? "s" : ""} caught · est. lost ${formatPKR(crCaughtLoss.lostIncentive)}`
                  : "Total incentive"}
              </div>
            )}
          </div>
        </div>

        {/* ── Income Streams Waterfall ── */}
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b">
            <div className="text-xs font-medium tracking-tight text-muted-foreground/70">Income Streams Breakdown</div>
          </div>
          {earningStreams.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center text-muted-foreground">No earnings this period.</div>
          ) : (
            earningStreams.map((s) => {
              const pct = report.totals.grandTotal > 0 ? (s.value / report.totals.grandTotal) * 100 : 0;
              return (
                <div key={s.label} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <div className="w-40 shrink-0 text-sm text-muted-foreground truncate">{s.label}</div>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                  </div>
                  <div className="w-8 text-right text-[11px] text-muted-foreground shrink-0">{pct.toFixed(0)}%</div>
                  <div className="w-28 text-right text-sm font-semibold tabular-nums shrink-0">{formatPKR(s.value)}</div>
                </div>
              );
            })
          )}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t font-semibold text-sm">
            <span>Grand Total (engine)</span>
            <span className="tabular-nums">{formatPKR(report.totals.grandTotal)}</span>
          </div>
        </div>

        {/* ── Target Bonus Status ── */}
        <div className={`rounded-xl border p-4 ${tb.eligible ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20" : "border-amber-300/60 bg-amber-50/40 dark:border-amber-700/50 dark:bg-amber-950/10"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {tb.eligible
                  ? <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  : <CircleX className="size-4 text-amber-600 dark:text-amber-400" />}
                <span className={`text-sm font-semibold ${tb.eligible ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                  Target Bonus — {tb.eligible ? "Achieved" : "Not Achieved"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground pl-6">
                {tb.actualQty} / {tb.targetQty ?? "—"} units purchased · {tb.bonusPercent}% bonus rate
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-black tabular-nums ${tb.eligible ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/50"}`}>
                {formatPKR(report.totals.bonusPercentEarned)}
              </div>
              {!tb.eligible && tb.targetQty != null && (
                <div className="text-[11px] text-muted-foreground">{tb.targetQty - tb.actualQty} more needed</div>
              )}
            </div>
          </div>
          {tb.targetQty != null && (
            <div className="mt-3 h-2 rounded-full bg-black/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${tb.eligible ? "bg-emerald-500" : "bg-amber-400"}`}
                style={{ width: `${Math.min(100, (tb.actualQty / tb.targetQty) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* ── OPPO Ledger Reconciliation ── */}
        <div className="rounded-xl border p-4 space-y-3">
          <div className="text-xs font-medium tracking-tight text-muted-foreground/70">Reconcile with OPPO Ledger</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Our calculation</label>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-semibold tabular-nums">
                {formatPKR(report.totals.grandTotal)}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">OPPO ledger says (PKR)</label>
              <Input
                type="number"
                placeholder="Paste OPPO's amount…"
                value={discrepancy}
                onChange={(e) => onDiscrepancy(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Delta (OPPO − engine)</label>
              <div
                className={`rounded-md border px-3 py-2 text-sm font-semibold tabular-nums ${
                  !discrepancy
                    ? "text-muted-foreground/50"
                    : delta === 0
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : delta < 0
                    ? "border-red-300 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                    : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                }`}
              >
                {discrepancy
                  ? `${delta >= 0 ? "+" : ""}${formatPKR(delta)}${delta < 0 ? " under-credited" : delta > 0 ? " over-credited" : " — matches"}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Per-Model Breakdown Table ── */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Per-Model Breakdown</h3>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-semibold">Model</TableHead>
                  <TableHead className="text-right font-semibold">Activated</TableHead>
                  <TableHead className="text-right font-semibold">Price Split</TableHead>
                  <TableHead className="text-right font-semibold">{report.baseIncentivePercent}%</TableHead>
                  <TableHead className="text-right font-semibold">{tb.bonusPercent}%</TableHead>
                  <TableHead className="text-right font-semibold">Act.</TableHead>
                  <TableHead className="text-right font-semibold">Dealer</TableHead>
                  <TableHead className="text-right font-semibold">Stock-In</TableHead>
                  <TableHead className="text-right font-semibold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      No data for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.rows.map((r) => (
                    <TableRow key={r.modelId} className={r.total > 0 ? "" : "opacity-60"}>
                      <TableCell className="font-medium">{r.modelName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span>{r.qtyActivated}</span>
                        {r.qtyActivatedCrossRegion > 0 && (
                          <Badge variant="secondary" className="ml-1.5 text-[10px]">
                            {r.qtyActivatedCrossRegion} CR
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                        {r.priceSubperiods.map((s, i) => (
                          <span key={i} className="ml-1 tabular-nums">
                            {s.qty}@{formatPKR(s.dealerPrice)}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatPKR(r.basePercentEarned)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatPKR(r.bonusPercentEarned)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatPKR(r.activationIncentiveEarned)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatPKR(r.dealerIncentiveEarned)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatPKR(r.stockInEarned)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-primary">
                        {formatPKR(r.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {report.totalActivationsCrossRegion > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground px-1">
              {report.totalActivationsCrossRegion} cross-region phone{report.totalActivationsCrossRegion > 1 ? "s" : ""} earn base%/bonus%/activation/dealer incentive but are excluded from stock-in.
            </p>
          )}
        </div>

        {/* ── Price-Drop Rebates Section ── */}
        {rebateRows.length > 0 && (
          <div className="rounded-xl border border-cyan-300 dark:border-cyan-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-cyan-50/80 dark:bg-cyan-950/30 border-b border-cyan-200 dark:border-cyan-800">
              <div className="flex items-center gap-2">
                <RefreshCw className="size-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-semibold tracking-tight text-cyan-700 dark:text-cyan-400">
                  Price-Drop Rebates — OPPO Owes You
                </span>
              </div>
              <div className="text-sm font-bold tabular-nums text-cyan-700 dark:text-cyan-400">
                {formatPKR(rebateTotal)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-cyan-50/40 dark:bg-cyan-950/10 hover:bg-cyan-50/40">
                    <TableHead>Date</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Dealer ID</TableHead>
                    <TableHead className="text-right">Old Price</TableHead>
                    <TableHead className="text-right">New Price</TableHead>
                    <TableHead className="text-right">−/Unit</TableHead>
                    <TableHead className="text-right">Stock Qty</TableHead>
                    <TableHead className="text-right">Rebate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rebateRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.rebateDate}</TableCell>
                      <TableCell className="font-medium">{r.modelName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.dealerName}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs line-through opacity-50">{formatPKR(r.oldDealerPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatPKR(r.newDealerPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                        +{formatPKR(r.rebatePerUnit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.eligibleQty}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold text-cyan-700 dark:text-cyan-400">
                        {formatPKR(r.totalRebateAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-cyan-50/60 dark:bg-cyan-950/20">
                    <TableCell colSpan={7} className="text-right text-sm font-semibold">Total Rebate Receivable</TableCell>
                    <TableCell className="text-right tabular-nums font-black text-cyan-700 dark:text-cyan-400">
                      {formatPKR(rebateTotal)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── CR-Caught Loss ── */}
        {crCaughtLoss.totalUnits > 0 && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-red-50/60 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-3.5 text-red-600 dark:text-red-400" />
                <span className="text-xs font-semibold tracking-tight text-red-600 dark:text-red-400">
                  CR-Caught Loss
                </span>
              </div>
              <Badge variant="outline" className="border-red-300 text-red-600 dark:text-red-400 text-[10px]">
                {crCaughtLoss.totalUnits} unit{crCaughtLoss.totalUnits > 1 ? "s" : ""} caught
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
              <div className="bg-card px-4 py-3">
                <div className="text-[10px] text-muted-foreground">Units Caught</div>
                <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{crCaughtLoss.totalUnits}</div>
              </div>
              <div className="bg-card px-4 py-3">
                <div className="text-[10px] text-muted-foreground">Est. Lost Incentive</div>
                <div className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{formatPKR(crCaughtLoss.lostIncentive)}</div>
                <div className="text-[10px] text-muted-foreground">base% × 1.25 on caught units</div>
              </div>
              {crCaughtLoss.totalFines > 0 && (
                <div className="bg-card px-4 py-3">
                  <div className="text-[10px] text-muted-foreground">Cash Fines</div>
                  <div className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{formatPKR(crCaughtLoss.totalFines)}</div>
                  <div className="text-[10px] text-muted-foreground">direct penalty deduction</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CR-Shifted Stock ── */}
        {crShiftedValue.totalUnits > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold">CR-Shifted Stock Received</h3>
              <Badge variant="secondary">{crShiftedValue.totalUnits} units · {formatPKR(crShiftedValue.totalValue)}</Badge>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Dealer Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crShiftedValue.byModel.map((m) => (
                    <TableRow key={m.modelId}>
                      <TableCell className="font-medium">{m.modelName}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.qty}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPKR(m.dealerPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{formatPKR(m.totalValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── Policies & Achievements ── */}
        {policies.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Policies &amp; Achievements</h3>
            <div className="space-y-2">
              {policies.map((p, i) => {
                const progPct = p.targetQty != null && p.targetQty > 0
                  ? Math.min(100, (p.actualQty / p.targetQty) * 100)
                  : null;
                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 ${
                      p.eligible
                        ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          {p.eligible
                            ? <CircleCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            : <CircleX className="size-3.5 text-muted-foreground/60 shrink-0" />}
                          <span className="text-sm font-medium capitalize">{p.type.replace(/-/g, " ")}</span>
                          {p.modelName && <Badge variant="secondary" className="text-[10px]">{p.modelName}</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground pl-5">
                          {p.periodStart} → {p.periodEnd}
                          {p.targetQty != null && ` · ${p.actualQty}/${p.targetQty} ${p.eligible ? "✓" : `(${p.targetQty - p.actualQty} more needed)`}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-base font-bold tabular-nums ${p.eligible ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/70"}`}>
                          {formatPKR(p.earned)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.type === "target-bonus" ? `${p.perUnitAmount}% rate` : `${formatPKR(p.perUnitAmount)}/unit`}
                        </div>
                      </div>
                    </div>
                    {progPct !== null && (
                      <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${p.eligible ? "bg-emerald-500" : "bg-primary/40"}`}
                          style={{ width: `${progPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

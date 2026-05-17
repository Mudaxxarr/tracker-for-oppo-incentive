"use client";

import { useMemo, useState } from "react";
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
import { FileBarChart2, FileSpreadsheet, ChevronDown } from "lucide-react";
import type { IncentiveReport } from "@/lib/incentive-engine";
import type { PolicyAchievementEntry } from "@/lib/report-types";

export type { PolicyAchievementEntry };

interface DealerOpt {
  id: string;
  name: string;
}

interface ReportEntry {
  dealerId: string;
  dealerName: string;
  report: IncentiveReport;
  policies: PolicyAchievementEntry[];
}

interface Props {
  dealers: DealerOpt[];
  initialDealerIds: string[];
  initialStart: string;
  initialEnd: string;
  reports: ReportEntry[];
}

function getMonthRange(offset: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
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
  const [discrepancyByDealer, setDiscrepancyByDealer] = useState<
    Record<string, string>
  >({});

  const apply = () => {
    const sp = new URLSearchParams();
    sp.set("periodStart", start);
    sp.set("periodEnd", end);
    if (selected.length > 0) sp.set("dealerIds", selected.join(","));
    router.replace(`/reports?${sp.toString()}`);
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
    });
    if (skipNoIncentive) sp.set("skipNoIncentive", "1");
    return `/api/report?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Forensic audit view. Compare what the engine calculated against OPPO's ledger.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Start</label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">End</label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={() => setPreset("this")}>
              This month
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreset("last")}>
              Last month
            </Button>
            <div className="ml-auto">
              <Button onClick={apply}>Generate</Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {dealers.map((d) => (
              <button
                key={d.id}
                onClick={() => toggle(d.id)}
                className={
                  selected.includes(d.id)
                    ? "rounded-full border bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                    : "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                }
              >
                {d.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Select at least one Dealer ID and click Generate.
          </CardContent>
        </Card>
      ) : null}

      {reports.map((entry) => (
        <ReportSection
          key={entry.dealerId}
          dealerName={entry.dealerName}
          report={entry.report}
          policies={entry.policies}
          discrepancy={discrepancyByDealer[entry.dealerId] ?? ""}
          onDiscrepancy={(v) =>
            setDiscrepancyByDealer((prev) => ({ ...prev, [entry.dealerId]: v }))
          }
          downloads={[
            { label: "PDF Report", icon: "pdf", href: exportLink(entry, "pdf") },
            { label: "PDF (Incentive models)", icon: "pdf", href: exportLink(entry, "pdf", true) },
            { label: "Detailed Breakup PDF", icon: "pdf", href: exportLink(entry, "detailed-pdf") },
            { label: "Excel (Full)", icon: "xlsx", href: exportLink(entry, "xlsx") },
            { label: "Excel (Incentive models)", icon: "xlsx", href: exportLink(entry, "xlsx", true) },
          ]}
        />
      ))}
    </div>
  );
}

interface DownloadItem {
  label: string;
  icon: "pdf" | "xlsx";
  href: string;
}

function ReportSection({
  dealerName,
  report,
  policies,
  discrepancy,
  onDiscrepancy,
  downloads,
}: {
  dealerName: string;
  report: IncentiveReport;
  policies: PolicyAchievementEntry[];
  discrepancy: string;
  onDiscrepancy: (v: string) => void;
  downloads: DownloadItem[];
}) {
  const [dropOpen, setDropOpen] = useState(false);
  const oppoLedger = Number(discrepancy.replace(/[^\d.-]/g, "")) || 0;
  const delta = oppoLedger - report.totals.grandTotal;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>{dealerName}</span>
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setDropOpen((o) => !o)}
            >
              <FileBarChart2 className="size-4" />
              Download
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
            {dropOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border bg-popover py-1 shadow-lg">
                  {downloads.map((d) => (
                    <a
                      key={d.href}
                      href={d.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setDropOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted"
                    >
                      {d.icon === "pdf"
                        ? <FileBarChart2 className="size-3.5 shrink-0 text-rose-500" />
                        : <FileSpreadsheet className="size-3.5 shrink-0 text-emerald-600" />}
                      {d.label}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <Stat label="Activations" value={report.totalActivations.toString()} />
          <Stat label="4% earned" value={formatPKR(report.totals.basePercentEarned)} />
          <Stat
            label={`${report.targetBonus.bonusPercent}% Bonus (on activations)`}
            value={formatPKR(report.totals.bonusPercentEarned)}
            sub={
              report.targetBonus.eligible
                ? `Purchase target met ✓ (${report.targetBonus.actualQty} purchased)`
                : `${report.targetBonus.actualQty}/${report.targetBonus.targetQty ?? "—"} purchased — not met`
            }
          />
          <Stat label="Activation incentive" value={formatPKR(report.totals.activationIncentiveEarned)} />
          <Stat label="Dealer incentive" value={formatPKR(report.totals.dealerIncentiveEarned)} />
          <Stat label="Stock-in" value={formatPKR(report.totals.stockInEarned)} />
        </div>

        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Grand total (engine)</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatPKR(report.totals.grandTotal)}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">OPPO ledger says (PKR)</label>
              <Input
                type="number"
                placeholder="paste OPPO's amount here…"
                value={discrepancy}
                onChange={(e) => onDiscrepancy(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Delta (OPPO − engine)</label>
              <div
                className={
                  delta === 0
                    ? "rounded-md border px-3 py-2 text-sm tabular-nums"
                    : delta < 0
                      ? "rounded-md border bg-destructive/10 px-3 py-2 text-sm font-medium tabular-nums text-destructive"
                      : "rounded-md border bg-emerald-500/10 px-3 py-2 text-sm font-medium tabular-nums text-emerald-600"
                }
              >
                {discrepancy ? formatPKR(delta) : "—"}
                {discrepancy && delta < 0 ? " under-credited" : ""}
                {discrepancy && delta > 0 ? " over-credited" : ""}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">Per model</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Old / New price split</TableHead>
                  <TableHead className="text-right">4%</TableHead>
                  <TableHead className="text-right">1%</TableHead>
                  <TableHead className="text-right">Activation</TableHead>
                  <TableHead className="text-right">Dealer</TableHead>
                  <TableHead className="text-right">Stock-In</TableHead>
                  <TableHead className="text-right">Total</TableHead>
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
                    <TableRow key={r.modelId}>
                      <TableCell className="font-medium">{r.modelName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.qtyActivated}
                        {r.qtyActivatedCrossRegion > 0 ? (
                          <Badge variant="secondary" className="ml-2">
                            {r.qtyActivatedCrossRegion} CR
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                        {r.priceSubperiods.map((s, i) => (
                          <span key={i} className="ml-1 tabular-nums">
                            {s.qty}@{formatPKR(s.dealerPrice)}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPKR(r.basePercentEarned)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPKR(r.bonusPercentEarned)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPKR(r.activationIncentiveEarned)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPKR(r.dealerIncentiveEarned)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPKR(r.stockInEarned)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatPKR(r.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {report.totalActivationsCrossRegion > 0 ? (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <strong>Cross-region note:</strong> {report.totalActivationsCrossRegion}{" "}
            phones were cross-region. They earn 4% / 1% / activation / dealer
            incentive but are excluded from stock-in.
          </div>
        ) : null}

        {policies.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Policies &amp; Achievements</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Per unit / %</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium capitalize">{p.type.replace(/-/g, " ")}</TableCell>
                      <TableCell className="text-xs">{p.modelName ?? <span className="text-muted-foreground">All models</span>}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{p.periodStart} → {p.periodEnd}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{p.targetQty ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {p.type === "target-bonus" ? `${p.perUnitAmount}%` : formatPKR(p.perUnitAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{p.actualQty}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-medium">{formatPKR(p.earned)}</TableCell>
                      <TableCell className="text-right">
                        {p.eligible
                          ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Met ✓</span>
                          : <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">Not Met ✗</span>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
      {sub ? <div className="text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

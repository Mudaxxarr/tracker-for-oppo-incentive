"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2, AlertTriangle, ArrowDownToLine, RefreshCw,
  TrendingDown, TrendingUp, Minus, CalendarDays, PackageSearch,
} from "lucide-react";
import { formatPKR, formatDate } from "@/lib/format";
import {
  getReconciliationDataAction,
  flagCrCaughtAction,
  logInwardCRAction,
} from "./actions";
import type { ReconciliationRow } from "@/lib/db/queries/reconciliation";

interface Props {
  initialRows: ReconciliationRow[];
  initialDate: string;
  hasDealer: boolean;
}

type RowInput = { activations: string; soPortal: string };
type ConfirmKind = "cr_caught" | "inward_cr";
type ConfirmState = { modelId: string; kind: ConfirmKind; qty: number } | null;

function buildInitialInputs(rows: ReconciliationRow[]): Record<string, RowInput> {
  return Object.fromEntries(
    rows.map((r) => [r.modelId, { activations: String(r.dbActivationsToday), soPortal: "" }])
  );
}

function computeVariance(row: ReconciliationRow, input: RowInput) {
  const acts = input.activations === "" ? 0 : parseInt(input.activations, 10);
  const activations = isNaN(acts) ? 0 : Math.max(0, acts);
  const expected = row.openingStock + row.purchasesToday - activations;
  const soParsed = input.soPortal === "" ? null : parseInt(input.soPortal, 10);
  const soPortal = soParsed !== null && !isNaN(soParsed) ? Math.max(0, soParsed) : null;
  const variance = soPortal !== null ? soPortal - expected : null;
  return { activations, expected, soPortal, variance };
}

type VarianceStatus = "reconciled" | "surplus" | "deficit" | "pending";

function getStatus(variance: number | null): VarianceStatus {
  if (variance === null) return "pending";
  if (variance === 0) return "reconciled";
  if (variance > 0) return "surplus";
  return "deficit";
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, variance }: { status: VarianceStatus; variance: number | null }) {
  if (status === "pending")
    return <span className="text-xs text-muted-foreground italic">Enter SO stock</span>;
  if (status === "reconciled")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Reconciled
      </span>
    );
  if (status === "surplus")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        <TrendingUp className="h-3 w-3" /> +{variance} surplus
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
      <TrendingDown className="h-3 w-3" /> {variance} missing
    </span>
  );
}

// ─── Expected stock cell ───────────────────────────────────────────────────────
function ExpectedCell({ expected, status }: { expected: number; status: VarianceStatus }) {
  const bg =
    status === "reconciled" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : status === "surplus"  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    : status === "deficit"  ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return (
    <span className={`inline-block min-w-[2.5rem] rounded-md px-2 py-0.5 text-center font-bold tabular-nums ${bg}`}>
      {expected}
    </span>
  );
}

export function ReconciliationClient({ initialRows, initialDate, hasDealer }: Props) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState<ReconciliationRow[]>(initialRows);
  const [inputs, setInputs] = useState<Record<string, RowInput>>(() => buildInitialInputs(initialRows));
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // modelId of in-progress action
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const fetchRows = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const fresh = await getReconciliationDataAction(d);
      setRows(fresh);
      setInputs(buildInitialInputs(fresh));
    } catch {
      toast.error("Failed to load reconciliation data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setConfirm(null);
    void fetchRows(newDate);
  };

  const setInput = (modelId: string, field: keyof RowInput, value: string) => {
    setInputs((prev) => ({ ...prev, [modelId]: { ...prev[modelId], [field]: value } }));
    if (confirm?.modelId === modelId) setConfirm(null);
  };

  // ─── Totals row ────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let opening = 0, purchases = 0, activations = 0, expected = 0;
    for (const row of rows) {
      const inp = inputs[row.modelId] ?? { activations: String(row.dbActivationsToday), soPortal: "" };
      const cv = computeVariance(row, inp);
      opening += row.openingStock;
      purchases += row.purchasesToday;
      activations += cv.activations;
      expected += cv.expected;
    }
    return { opening, purchases, activations, expected };
  }, [rows, inputs]);

  // ─── Action handlers ───────────────────────────────────────────────────────
  const requestConfirm = (modelId: string, kind: ConfirmKind, qty: number) => {
    setConfirm({ modelId, kind, qty });
  };

  const handleConfirmedAction = async () => {
    if (!confirm) return;
    const { modelId, kind, qty } = confirm;
    setBusy(modelId);
    setConfirm(null);

    const result =
      kind === "cr_caught"
        ? await flagCrCaughtAction({ modelId, quantity: qty, date })
        : await logInwardCRAction({ modelId, quantity: qty, date });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        kind === "cr_caught"
          ? `${qty} unit(s) flagged as CR Caught`
          : `${qty} unit(s) logged as Inward CR`
      );
      // Reset SO Portal input for this row and refresh data
      setInputs((prev) => ({ ...prev, [modelId]: { ...prev[modelId], soPortal: "" } }));
      void fetchRows(date);
    }
    setBusy(null);
  };

  if (!hasDealer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <PackageSearch className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">No active Dealer ID. Create one in IDs first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Daily Reconciliation</h1>
          <p className="text-sm text-muted-foreground">
            Night-closing variance trap — compare expected vs SO portal stock
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-40 text-sm"
            max={new Date().toISOString().slice(0, 10)}
          />
          <Button variant="outline" size="sm" onClick={() => void fetchRows(date)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Reconciled</span>
        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-blue-500" /> Surplus → Log Inward CR</span>
        <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-500" /> Deficit → Flag CR Caught</span>
        <span className="flex items-center gap-1"><Minus className="h-3 w-3 text-slate-400" /> Fill in SO Portal Stock to see status</span>
      </div>

      {/* ── Confirm banner ── */}
      {confirm && (() => {
        const row = rows.find((r) => r.modelId === confirm.modelId);
        const isCR = confirm.kind === "cr_caught";
        return (
          <div className={`rounded-lg border px-4 py-3 text-sm ${isCR ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40" : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40"}`}>
            <p className={`font-semibold ${isCR ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300"}`}>
              {isCR
                ? `Confirm: Flag ${confirm.qty} missing unit(s) of ${row?.modelName} as CR Caught on ${formatDate(date)}?`
                : `Confirm: Log ${confirm.qty} extra unit(s) of ${row?.modelName} as Inward CR on ${formatDate(date)}?`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isCR
                ? "These units will be immediately deducted from active inventory."
                : "A new purchase entry (Cross-Region In) will be created in the ledger."}
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant={isCR ? "destructive" : "default"} onClick={handleConfirmedAction}>
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
            </div>
          </div>
        );
      })()}

      {/* ── Table ── */}
      {rows.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center text-muted-foreground">
          <PackageSearch className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">No stock found for {formatDate(date)}.</p>
          <p className="mt-1 text-xs opacity-60">Try selecting a different date or adding purchases.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-medium uppercase text-muted-foreground">
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-3 py-3 text-center">Opening</th>
                <th className="px-3 py-3 text-center">Received</th>
                <th className="px-3 py-3 text-center">Activations</th>
                <th className="px-3 py-3 text-center">Expected</th>
                <th className="px-3 py-3 text-center">SO Portal</th>
                <th className="px-4 py-3 text-right">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const inp = inputs[row.modelId] ?? { activations: String(row.dbActivationsToday), soPortal: "" };
                const { activations, expected, soPortal, variance } = computeVariance(row, inp);
                const status = getStatus(variance);
                const isBusy = busy === row.modelId;
                const isConfirming = confirm?.modelId === row.modelId;

                return (
                  <tr
                    key={row.modelId}
                    className={`transition-colors ${
                      isConfirming
                        ? status === "deficit" ? "bg-red-50/60 dark:bg-red-950/20" : "bg-blue-50/60 dark:bg-blue-950/20"
                        : "hover:bg-muted/20"
                    }`}
                  >
                    {/* Model */}
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.modelName}</p>
                      {row.dealerPrice !== null && (
                        <p className="text-xs text-muted-foreground">{formatPKR(row.dealerPrice)}</p>
                      )}
                    </td>

                    {/* Opening Stock */}
                    <td className="px-3 py-3 text-center tabular-nums">
                      <span className="font-mono text-sm">{row.openingStock}</span>
                    </td>

                    {/* Received Today */}
                    <td className="px-3 py-3 text-center tabular-nums">
                      {row.purchasesToday > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                          <ArrowDownToLine className="h-3 w-3" />{row.purchasesToday}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 font-mono text-sm">0</span>
                      )}
                    </td>

                    {/* Activations (editable) */}
                    <td className="px-3 py-3 text-center">
                      <Input
                        type="number"
                        min={0}
                        value={inp.activations}
                        onChange={(e) => setInput(row.modelId, "activations", e.target.value)}
                        className="h-8 w-16 text-center tabular-nums text-sm mx-auto"
                        disabled={isBusy}
                      />
                    </td>

                    {/* Expected Closing */}
                    <td className="px-3 py-3 text-center">
                      <ExpectedCell expected={expected} status={status} />
                    </td>

                    {/* SO Portal Stock (editable) */}
                    <td className="px-3 py-3 text-center">
                      <Input
                        type="number"
                        min={0}
                        placeholder="—"
                        value={inp.soPortal}
                        onChange={(e) => setInput(row.modelId, "soPortal", e.target.value)}
                        className={`h-8 w-16 text-center tabular-nums text-sm mx-auto ${
                          status === "deficit" ? "border-red-300 focus-visible:ring-red-400"
                          : status === "surplus" ? "border-blue-300 focus-visible:ring-blue-400"
                          : ""
                        }`}
                        disabled={isBusy}
                      />
                    </td>

                    {/* Status + Action */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={status} variance={variance} />
                        {status === "deficit" && variance !== null && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            disabled={isBusy || isConfirming}
                            onClick={() => requestConfirm(row.modelId, "cr_caught", Math.abs(variance))}
                          >
                            <TrendingDown className="mr-1 h-3 w-3" />
                            Flag CR Caught ({Math.abs(variance)})
                          </Button>
                        )}
                        {status === "surplus" && variance !== null && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/40"
                            disabled={isBusy || isConfirming}
                            onClick={() => requestConfirm(row.modelId, "inward_cr", Math.abs(variance))}
                          >
                            <ArrowDownToLine className="mr-1 h-3 w-3" />
                            Log Inward CR (+{variance})
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* ── Totals ── */}
            {rows.length > 1 && (
              <tfoot>
                <tr className="border-t bg-muted/30 font-semibold text-sm">
                  <td className="px-4 py-3 text-muted-foreground">TOTAL</td>
                  <td className="px-3 py-3 text-center tabular-nums">{totals.opening}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{totals.purchases}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{totals.activations}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-block min-w-[2.5rem] rounded-md bg-slate-100 px-2 py-0.5 text-center font-bold tabular-nums dark:bg-slate-800">
                      {totals.expected}
                    </span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── Instructions ── */}
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p><strong>How to use:</strong></p>
        <p>1. The <strong>Opening Stock</strong> is automatically calculated from yesterday&apos;s closing position.</p>
        <p>2. The <strong>Activations</strong> column is pre-filled from today&apos;s logged entries — adjust if the SO has reported different figures verbally.</p>
        <p>3. Type the stock count shown on the <strong>SO&apos;s device/portal</strong> in the last column.</p>
        <p>4. The <strong>Expected</strong> column updates in real-time. A mismatch will reveal the action to take.</p>
      </div>
    </div>
  );
}

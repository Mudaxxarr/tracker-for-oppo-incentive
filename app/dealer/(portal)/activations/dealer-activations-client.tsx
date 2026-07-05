"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataValue } from "@/components/ui/data-value";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DealerActivationForm } from "./dealer-activation-form";
import { DealerBulkActivationForm } from "./dealer-bulk-activation-form";
import {
  getDealerActivationSummaryAction,
  getDealerDailyActivationsAction,
  deleteDealerActivationAction,
  bulkDeleteDealerActivationsAction,
  type ModelQtyRow,
  type DailyModelRow,
} from "./actions";
import { formatDate, formatPKR, maskImei } from "@/lib/format";
import { Plus, Trash2, BarChart3, CalendarDays, CheckSquare, Smartphone } from "lucide-react";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { ActivationRow } from "@/lib/db/queries/activations";
import type { StockRow } from "@/lib/db/queries/purchases";

type Preset = "month" | "week" | "today" | "custom";

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

function dateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  if (dateStr === dayBefore) return "Day before yesterday";
  return formatDate(dateStr);
}

interface Props {
  models: ModelWithCurrentPrice[];
  stock: StockRow[];
  initialActivations: ActivationRow[];
  initialFilters: { modelId?: string; from?: string; to?: string };
  hasDealer: boolean;
  dealerId: string | null;
  tenantId: string;
  role: "admin" | "exec";
  canBulk: boolean;
  canBulkDelete: boolean;
}

export function DealerActivationsClient({
  models,
  stock,
  initialActivations,
  initialFilters,
  hasDealer,
  dealerId,
  tenantId,
  role,
  canBulk,
  canBulkDelete,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const [view, setView] = useState<"records" | "summary" | "daily">("records");
  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState(presetRange("month").from);
  const [customTo, setCustomTo] = useState(presetRange("month").to);
  const [summaryRows, setSummaryRows] = useState<ModelQtyRow[]>([]);
  const [dailyRows, setDailyRows] = useState<DailyModelRow[]>([]);
  const [analyticsLoading, startAnalytics] = useTransition();

  const updateFilter = (key: keyof typeof filters, value: string | undefined) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    setSelected(new Set());
    const search = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v) search.set(k, v); });
    router.replace(`/dealer/activations${search.size ? `?${search}` : ""}`);
  };

  const handleDelete = (id: string, modelName: string) => {
    if (!confirm(`Delete this ${modelName} activation? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteDealerActivationAction(id);
        setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
        toast.success("Activation deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const handleBulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} activation(s)? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        const { deleted } = await bulkDeleteDealerActivationsAction(ids);
        setSelected(new Set());
        toast.success(`${deleted} activation(s) deleted`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const allIds = initialActivations.map((a) => a.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const loadAnalytics = (from: string, to: string, targetView: "summary" | "daily") => {
    startAnalytics(async () => {
      if (targetView === "summary") {
        const rows = await getDealerActivationSummaryAction(from, to);
        setSummaryRows(rows);
      } else {
        const rows = await getDealerDailyActivationsAction(from, to);
        setDailyRows(rows);
      }
    });
  };

  const applyPreset = (p: Preset, targetView: "summary" | "daily") => {
    setPreset(p);
    if (p !== "custom") {
      const { from, to } = presetRange(p);
      setCustomFrom(from);
      setCustomTo(to);
      loadAnalytics(from, to, targetView);
    }
  };

  const switchView = (v: "records" | "summary" | "daily") => {
    setView(v);
    if (v === "summary" && summaryRows.length === 0) {
      const { from, to } = presetRange(preset === "custom" ? "month" : preset);
      loadAnalytics(from, to, "summary");
    }
    if (v === "daily" && dailyRows.length === 0) {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      setCustomFrom(from);
      setCustomTo(to);
      loadAnalytics(from, to, "daily");
    }
  };

  const summaryTotal = summaryRows.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Activations</h1>
          <p className="text-sm text-muted-foreground">
            Each row locks the dealer price effective on activation date.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border text-xs">
            {(
              [
                ["records", "Records"],
                ["summary", "Summary"],
                ["daily", "Daily"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={`px-3 py-1.5 transition-colors ${
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {hasDealer && stock.length > 0 ? (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger render={<Button size="sm"><Plus className="size-4" />Add Activation</Button>} />
              <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Add Activation</SheetTitle>
                </SheetHeader>
                <div className="p-4">
                  <Tabs defaultValue="single">
                    <TabsList className={cn("grid w-full", canBulk ? "grid-cols-2" : "grid-cols-1")}>
                      <TabsTrigger value="single">Single</TabsTrigger>
                      {canBulk && <TabsTrigger value="bulk">Bulk by Date</TabsTrigger>}
                    </TabsList>
                    <TabsContent value="single" className="pt-3">
                      <DealerActivationForm
                        stock={stock}
                        dealerId={dealerId ?? ""}
                        tenantId={tenantId}
                        role={role}
                        onSuccess={() => { setOpen(false); router.refresh(); }}
                      />
                    </TabsContent>
                    {canBulk && (
                      <TabsContent value="bulk" className="pt-3">
                        <DealerBulkActivationForm
                          stock={stock}
                          onSuccess={() => { setOpen(false); router.refresh(); }}
                        />
                      </TabsContent>
                    )}
                  </Tabs>
                </div>
              </SheetContent>
            </Sheet>
          ) : null}
        </div>
      </div>

      {/* ── RECORDS ── */}
      {view === "records" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Select
                  value={filters.modelId ?? "all"}
                  onValueChange={(v) =>
                    updateFilter("modelId", typeof v === "string" && v !== "all" ? v : undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All models</SelectItem>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={filters.from ?? ""}
                  onChange={(e) => updateFilter("from", e.target.value || undefined)}
                  aria-label="From date"
                />
                <Input
                  type="date"
                  value={filters.to ?? ""}
                  onChange={(e) => updateFilter("to", e.target.value || undefined)}
                  aria-label="To date"
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            {canBulkDelete && someSelected && (
              <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-4 py-2.5">
                <span className="text-sm font-medium">
                  <CheckSquare className="mr-1.5 inline size-4 text-primary" />
                  {selected.size} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => setSelected(new Set())}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 text-xs"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="size-3.5" /> Delete selected
                  </Button>
                </div>
              </div>
            )}
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canBulkDelete && (
                        <TableHead className="w-10 pl-4">
                          <input
                            type="checkbox"
                            className="size-4 cursor-pointer rounded border-border accent-primary"
                            checked={allSelected}
                            onChange={toggleAll}
                            aria-label="Select all"
                          />
                        </TableHead>
                      )}
                      <TableHead>Date</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead className="text-right">Price snap ₨</TableHead>
                      <TableHead></TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialActivations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canBulkDelete ? 7 : 6}>
                          <EmptyState icon={Smartphone} title="No activations recorded yet." description="Add your first activation to start tracking." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      initialActivations.map((a) => (
                        <TableRow
                          key={a.id}
                          data-selected={selected.has(a.id)}
                          className="data-[selected=true]:bg-primary/5"
                        >
                          {canBulkDelete && (
                            <TableCell className="pl-4">
                              <input
                                type="checkbox"
                                className="size-4 cursor-pointer rounded border-border accent-primary"
                                checked={selected.has(a.id)}
                                onChange={() => toggleOne(a.id)}
                                aria-label="Select row"
                              />
                            </TableCell>
                          )}
                          <TableCell label="Date">{formatDate(a.activationDate)}</TableCell>
                          <TableCell className="font-medium">{a.modelName}</TableCell>
                          <TableCell label="IMEI" className="font-mono text-xs">{maskImei(a.imei)}</TableCell>
                          <TableCell label="Price ₨" className="text-right">
                            <DataValue value={a.dealerPriceSnapshot} format="currency" />
                          </TableCell>
                          <TableCell>
                            {a.isCrossRegion ? (
                              <StatusBadge status="neutral" label="Cross-Region" />
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete"
                              onClick={() => handleDelete(a.id, a.modelName)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* ── SUMMARY ── */}
      {view === "summary" ? (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4" /> Period Summary
            </CardTitle>
            <DatePresetBar
              preset={preset}
              customFrom={customFrom}
              customTo={customTo}
              onPreset={(p) => applyPreset(p, "summary")}
              onCustomFrom={setCustomFrom}
              onCustomTo={setCustomTo}
              onApply={() => loadAnalytics(customFrom, customTo, "summary")}
            />
          </CardHeader>
          <CardContent className="p-0">
            {analyticsLoading ? (
              <div className="animate-pulse p-6 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : summaryRows.length === 0 ? (
              <EmptyState icon={BarChart3} title="No activations in this period." />
            ) : (
              <div className="divide-y">
                {summaryRows.map((r) => (
                  <div key={r.modelId} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium">{r.modelName}</span>
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      <DataValue value={r.qty} /> sold
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 text-sm font-medium">
                  <span className="text-muted-foreground">{summaryRows.length} model(s)</span>
                  <span className="tabular-nums">{summaryTotal} total</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ── DAILY ── */}
      {view === "daily" ? (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4" /> Daily Sales
            </CardTitle>
            <DatePresetBar
              preset={preset}
              customFrom={customFrom}
              customTo={customTo}
              onPreset={(p) => applyPreset(p, "daily")}
              onCustomFrom={setCustomFrom}
              onCustomTo={setCustomTo}
              onApply={() => loadAnalytics(customFrom, customTo, "daily")}
            />
          </CardHeader>
          <CardContent className="p-0">
            {analyticsLoading ? (
              <div className="animate-pulse p-6 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : dailyRows.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No activations in this period." />
            ) : (
              <div className="divide-y">
                {dailyRows.map((day) => (
                  <div key={day.date} className="p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {dateLabel(day.date)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {day.models.map((m) => (
                        <div
                          key={m.modelId}
                          className="flex min-w-[72px] flex-col items-center rounded-xl border bg-card px-3 py-2 shadow-sm"
                        >
                          <span className="max-w-[80px] truncate text-center text-[10px] leading-tight text-muted-foreground">
                            {m.modelName}
                          </span>
                          <span className="mt-1 font-mono text-xl font-bold tabular-nums text-foreground">
                            {m.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DatePresetBar({
  preset,
  customFrom,
  customTo,
  onPreset,
  onCustomFrom,
  onCustomTo,
  onApply,
}: {
  preset: Preset;
  customFrom: string;
  customTo: string;
  onPreset: (p: Preset) => void;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(["month", "week", "today", "custom"] as Preset[]).map((p) => (
        <button
          key={p}
          onClick={() => onPreset(p)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
      {preset === "custom" ? (
        <>
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFrom(e.target.value)}
            className="h-7 w-32 text-xs"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => onCustomTo(e.target.value)}
            className="h-7 w-32 text-xs"
          />
          <Button size="sm" className="h-7 text-xs" onClick={onApply}>
            Apply
          </Button>
        </>
      ) : null}
    </div>
  );
}

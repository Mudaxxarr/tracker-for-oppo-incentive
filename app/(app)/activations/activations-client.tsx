"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
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
import { ActivationForm } from "./activation-form";
import { BulkActivationForm } from "./bulk-form";
import { getPriceOnDateAction } from "./data-actions";
import { PurchaseKpiCard } from "../purchases/purchase-kpi-card";
import { PurchaseTrendChart } from "../purchases/purchase-trend-chart";
import { PurchaseTopModelsPanel } from "../purchases/purchase-top-models-panel";
import { ActivationTimeline } from "./activation-timeline";
import { formatDate, formatPKR, maskImei } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Pencil, Plus, Trash2, CheckSquare, Smartphone, Wallet, Target, TrendingUp, Layers, ArrowLeftRight, Filter } from "lucide-react";
import {
  deleteActivationAction,
  bulkDeleteActivationsAction,
  updateActivationAction,
  requestActivationDeletionAction,
  type ActivationFormState,
} from "./actions";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { ActivationRow, ActivationOverviewStats } from "@/lib/db/queries/activations";
import type { StockRow } from "@/lib/db/queries/purchases";
import type { StaffRole } from "@/lib/constants";

type CrFilter = "all" | "regular" | "cross";

interface Props {
  models: ModelWithCurrentPrice[];
  stock: StockRow[];
  initialActivations: ActivationRow[];
  initialFilters: { modelId?: string; from?: string; to?: string };
  hasDealer: boolean;
  dealerId: string | null;
  tenantId: string;
  staffRole?: StaffRole | null;
  overview: ActivationOverviewStats | null;
  overviewRange: { from: string; to: string };
  basePercent: number;
}

export function ActivationsClient({
  models,
  stock,
  initialActivations,
  initialFilters,
  hasDealer,
  dealerId,
  tenantId,
  staffRole,
  overview,
  overviewRange,
  basePercent,
}: Props) {
  const isSO = staffRole === "so";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"records" | "overview">("overview");
  const [mobileTab, setMobileTab] = useState<"daily" | "overview">("daily");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [crFilter, setCrFilter] = useState<CrFilter>("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const updateFilter = (key: keyof typeof filters, value: string | undefined) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    setSelected(new Set());
    const search = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v) search.set(k, v); });
    router.replace(`/activations${search.size ? `?${search}` : ""}`);
  };

  const handleDelete = (id: string, modelName: string) => {
    if (!confirm(`Delete this ${modelName} activation? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteActivationAction(id);
        setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
        toast.success("Activation deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const handleRequestDelete = (id: string, modelName: string) => {
    if (!confirm(`Request deletion of this ${modelName} activation? The owner will be notified.`)) return;
    startTransition(async () => {
      const result = await requestActivationDeletionAction(id);
      if (result.ok) toast.success("Deletion request sent to owner");
      else toast.error(result.error ?? "Request failed");
    });
  };

  const handleBulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} activation(s)? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        const { deleted } = await bulkDeleteActivationsAction(ids);
        setSelected(new Set());
        toast.success(`${deleted} activation(s) deleted`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  // Records rows honour the client-side cross-region filter.
  const recordRows = useMemo(
    () => initialActivations.filter((a) => (crFilter === "all" ? true : crFilter === "cross" ? a.isCrossRegion : !a.isCrossRegion)),
    [initialActivations, crFilter]
  );
  const allIds = recordRows.map((a) => a.id);
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
  const onEditDone = () => { setEditId(null); router.refresh(); };

  // ── Derived Overview view-models ────────────────────────────────────────────
  const cur = overview?.current;
  const trendData = (cur?.dailySeries ?? []).map((p) => ({ date: p.date, amount: 0, qty: p.count }));
  const topModels = (cur?.topModels ?? []).map((m) => ({ modelId: m.modelId, modelName: m.modelName, qty: m.count }));
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = overview?.timeline.find((g) => g.date === today)?.count ?? 0;
  const quietestDay = cur && cur.dailySeries.length > 0
    ? cur.dailySeries.reduce((min, p) => (p.count < min.count ? p : min))
    : null;

  const targetValue = overview && overview.targetProgress.percent != null ? `${overview.targetProgress.percent}%` : "—";
  const sellThroughValue = overview && overview.sellThrough.percent != null ? `${overview.sellThrough.percent}%` : "—";
  const incentiveValue = overview ? formatPKR(overview.totalIncentiveEarned) : "—";

  const kpis = {
    total: String(cur?.totalActivations ?? 0),
    incentive: incentiveValue,
    target: targetValue,
    sellThrough: sellThroughValue,
    models: String(cur?.uniqueModels ?? 0),
    crossRegion: String(cur?.crossRegionCount ?? 0),
  };

  const renderOverview = (compact: boolean) => {
    if (!overview || !cur) {
      return <EmptyState icon={Smartphone} title="No activation data yet." description="Add an activation to see the overview." />;
    }
    return (
      <div className="space-y-4">
        <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6")}>
          <PurchaseKpiCard icon={Smartphone} label="Total Activations" value={kpis.total} deltaPercent={overview.growthPercent} />
          <PurchaseKpiCard icon={Wallet} label="Incentive Earned" value={kpis.incentive} />
          <PurchaseKpiCard icon={Target} label="Target Progress" value={kpis.target} />
          <PurchaseKpiCard icon={TrendingUp} label="Sell-through" value={kpis.sellThrough} />
          <PurchaseKpiCard icon={Layers} label="Unique Models" value={kpis.models} />
          <PurchaseKpiCard icon={ArrowLeftRight} label="Cross-Region" value={kpis.crossRegion} />
        </div>

        {compact ? (
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm opacity-80">Today&apos;s Activations</p>
                <p className="text-2xl font-semibold tabular-nums">{todayCount}</p>
                <p className="mt-1 text-xs opacity-80">This period: {cur.totalActivations}</p>
              </div>
              <span className="grid size-9 place-items-center rounded-full bg-white/15">
                <Smartphone className="size-4" />
              </span>
            </div>
            <PurchaseTrendChart
              data={trendData}
              dataKey="qty"
              variant="sparkline"
              color="var(--primary-foreground)"
              dotStroke="var(--primary)"
              valueFormatter={(v) => String(v)}
              className="mt-3"
            />
          </div>
        ) : null}

        <div className={cn("grid gap-4", compact ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-3")}>
          <div className={cn("rounded-xl border border-border bg-card p-4", !compact && "xl:col-span-2")}>
            <p className="mb-2 text-sm font-medium">Daily Activations</p>
            <PurchaseTrendChart data={trendData} dataKey="qty" valueFormatter={(v) => String(v)} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Top Models by Activation</p>
            <PurchaseTopModelsPanel models={topModels} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Highlights</p>
          <dl className="divide-y">
            <HighlightRow label="Best Selling Model" value={cur.topModels[0] ? `${cur.topModels[0].modelName} · ${cur.topModels[0].count}` : "—"} />
            <HighlightRow label="Busiest Day" value={cur.busiestDay ? `${formatDate(cur.busiestDay.date)} · ${cur.busiestDay.count}` : "—"} />
            <HighlightRow label="Quietest Day" value={quietestDay ? `${formatDate(quietestDay.date)} · ${quietestDay.count}` : "—"} />
            <HighlightRow label="Avg / Active Day" value={cur.avgPerActiveDay > 0 ? cur.avgPerActiveDay.toFixed(1) : "—"} />
            <HighlightRow label="Cross-Region Share" value={`${cur.crossRegionPercent}%`} />
            <HighlightRow
              label="Target"
              value={overview.targetProgress.targetQty != null ? `${overview.targetProgress.actualQty} / ${overview.targetProgress.targetQty}` : "No target set"}
            />
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Activation Timeline</p>
          <ActivationTimeline groups={overview.timeline} />
        </div>
      </div>
    );
  };

  const filterControls = (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Models</span>
        <Select
          value={filters.modelId ?? "all"}
          onValueChange={(v) => updateFilter("modelId", typeof v === "string" && v !== "all" ? v : undefined)}
        >
          <SelectTrigger><SelectValue placeholder="All models" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Source</span>
        <Select value={crFilter} onValueChange={(v) => typeof v === "string" && setCrFilter(v as CrFilter)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="cross">Cross-Region</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">From date</span>
        <Input type="date" value={filters.from ?? ""} onChange={(e) => updateFilter("from", e.target.value || undefined)} aria-label="From date" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">To date</span>
        <Input type="date" value={filters.to ?? ""} onChange={(e) => updateFilter("to", e.target.value || undefined)} aria-label="To date" />
      </div>
    </>
  );

  const recordsTable = (
    <Card>
      {someSelected && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 bg-muted/50">
          <span className="text-sm font-medium">
            <CheckSquare className="mr-1.5 inline size-4 text-primary" />
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
            {!isSO && (
              <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={handleBulkDelete}>
                <Trash2 className="size-3.5" /> Delete selected
              </Button>
            )}
          </div>
        </div>
      )}
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <input type="checkbox" className="size-4 cursor-pointer rounded border-border accent-primary" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Model</TableHead>
                <TableHead>IMEI</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Dealer ₨</TableHead>
                <TableHead className="text-right">Incentive ₨</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState icon={Smartphone} title="No activations to show." description="Add an activation or adjust the filters." />
                  </TableCell>
                </TableRow>
              ) : recordRows.map((a) => {
                if (editId === a.id) {
                  return <EditActivationRow key={a.id} row={a} onDone={onEditDone} onCancel={() => setEditId(null)} />;
                }
                return (
                  <TableRow key={a.id} data-selected={selected.has(a.id)} className="data-[selected=true]:bg-primary/5">
                    <TableCell className="pl-4">
                      <input type="checkbox" className="size-4 cursor-pointer rounded border-border accent-primary" checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} aria-label="Select row" />
                    </TableCell>
                    <TableCell className="font-medium">{a.modelName}</TableCell>
                    <TableCell label="IMEI" className="font-mono text-xs">{maskImei(a.imei)}</TableCell>
                    <TableCell label="Date">{formatDate(a.activationDate)}</TableCell>
                    <TableCell label="Dealer ₨" className="text-right"><DataValue value={a.dealerPriceSnapshot} format="currency" /></TableCell>
                    <TableCell label="Incentive ₨" className="text-right"><DataValue value={Math.round(a.dealerPriceSnapshot * basePercent / 100)} format="currency" /></TableCell>
                    <TableCell label="Source">
                      {a.isCrossRegion ? <StatusBadge status="neutral" label="Cross-Region" /> : <StatusBadge status="confirmed" label="Regular" />}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditId(a.id)}>
                          <Pencil className="size-4" />
                        </Button>
                        {isSO ? (
                          <Button variant="ghost" size="icon" aria-label="Request deletion" title="Request owner to delete this activation" onClick={() => handleRequestDelete(a.id, a.modelName)}>
                            <Trash2 className="size-4 text-amber-500" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => handleDelete(a.id, a.modelName)}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const addButton = hasDealer && stock.length > 0 ? (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button><Plus className="size-4" />Add Activation</Button>} />
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Add Activation</SheetTitle></SheetHeader>
        <div className="p-4">
          <Tabs defaultValue="single">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single</TabsTrigger>
              <TabsTrigger value="bulk">Bulk by Date</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="pt-3">
              <ActivationForm stock={stock} dealerId={dealerId ?? ""} tenantId={tenantId} onSuccess={() => { setOpen(false); router.refresh(); }} />
            </TabsContent>
            <TabsContent value="bulk" className="pt-3">
              <BulkActivationForm stock={stock} onSuccess={() => { setOpen(false); router.refresh(); }} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Activations</h1>
          <p className="text-sm text-muted-foreground">Each row locks the dealer price effective on activation date.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex rounded-lg border overflow-hidden text-xs">
            {(["overview", "records"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 transition-colors ${view === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                {v === "overview" ? "Overview" : "Records"}
              </button>
            ))}
          </div>
          {addButton}
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="md:hidden">
        <div className="mb-3 flex rounded-lg border overflow-hidden text-xs">
          {(["daily", "overview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMobileTab(t)}
              className={`flex-1 px-3 py-2 transition-colors ${mobileTab === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              {t === "daily" ? "Daily" : "Overview"}
            </button>
          ))}
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{formatDate(overviewRange.from)} – {formatDate(overviewRange.to)}</p>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowMobileFilters((v) => !v)}>
            <Filter className="size-3.5" /> Filter
          </Button>
        </div>

        {showMobileFilters ? (
          <Card className="mb-4">
            <CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">{filterControls}</CardContent>
          </Card>
        ) : null}

        {mobileTab === "daily" ? (
          <div className="space-y-4">
            {overview && cur ? (
              <div className="grid grid-cols-2 gap-3">
                <PurchaseKpiCard icon={Smartphone} label="Total Activations" value={kpis.total} />
                <PurchaseKpiCard icon={Wallet} label="Incentive Earned" value={kpis.incentive} />
                <PurchaseKpiCard icon={Target} label="Target Progress" value={kpis.target} />
                <PurchaseKpiCard icon={TrendingUp} label="Sell-through" value={kpis.sellThrough} />
              </div>
            ) : null}
            <ActivationTimeline groups={overview?.timeline ?? []} />
          </div>
        ) : null}

        {mobileTab === "overview" ? renderOverview(true) : null}
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden md:block space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">{filterControls}</div>
          </CardContent>
        </Card>

        {view === "overview" ? renderOverview(false) : recordsTable}
      </div>
    </div>
  );
}

function HighlightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium tabular-nums" title={value}>{value}</dd>
    </div>
  );
}

function EditActivationRow({
  row,
  onDone,
  onCancel,
}: {
  row: ActivationRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<ActivationFormState, FormData>(updateActivationAction, {});
  const today = new Date().toISOString().slice(0, 10);
  const [activationDate, setActivationDate] = useState(row.activationDate);
  const [imei, setImei] = useState(row.imei ?? "");
  const [isCrossRegion, setIsCrossRegion] = useState(row.isCrossRegion);
  const [resolvedPrice, setResolvedPrice] = useState<number | null>(row.dealerPriceSnapshot);

  useEffect(() => {
    let cancelled = false;
    getPriceOnDateAction(row.modelId, activationDate).then((p) => {
      if (!cancelled) setResolvedPrice(p?.dealerPrice ?? null);
    });
    return () => { cancelled = true; };
  }, [activationDate, row.modelId]);

  useEffect(() => {
    if (state.ok) { toast.success("Activation updated"); onDone(); }
    else if (state.error) toast.error(state.error);
  }, [state, onDone]);

  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={8} className="p-2">
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="modelId" value={row.modelId} />
          <span className="min-w-[80px] text-sm font-medium">{row.modelName}</span>
          <Input name="activationDate" type="date" value={activationDate} max={today} onChange={(e) => setActivationDate(e.target.value)} required className="w-36" />
          <Input name="imei" type="text" value={imei} onChange={(e) => setImei(e.target.value)} placeholder="IMEI (optional)" inputMode="numeric" maxLength={16} className="w-40" />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" name="isCrossRegion" value="on" checked={isCrossRegion} onChange={(e) => setIsCrossRegion(e.target.checked)} className="size-3.5" />
            Cross-region
          </label>
          {resolvedPrice !== null ? (
            <span className="text-xs text-muted-foreground">Price: <strong className="text-foreground">{formatPKR(resolvedPrice)}</strong></span>
          ) : (
            <span className="text-xs text-destructive">No price on this date</span>
          )}
          <Button type="submit" size="sm" disabled={pending || resolvedPrice === null}>{pending ? "Saving…" : "Save"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

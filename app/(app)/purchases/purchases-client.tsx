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
import { PurchaseForm } from "./purchase-form";
import { BulkInvoiceForm } from "./bulk-invoice-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { formatDate, formatPKR } from "@/lib/format";
import { CheckSquare, Pencil, Plus, Trash2, AlertCircle, ShoppingCart, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deletePurchaseAction,
  updatePurchaseAction,
  bulkDeletePurchasesAction,
  type PurchaseFormState,
} from "./actions";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { PurchaseRow } from "@/lib/db/queries/purchases";

interface Props {
  models: ModelWithCurrentPrice[];
  initialPurchases: PurchaseRow[];
  initialFilters: { modelId?: string; source?: string; from?: string; to?: string };
  hasDealer: boolean;
}

export function PurchasesClient({ models, initialPurchases, initialFilters, hasDealer }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"records" | "by-date">("records");
  const [filters, setFilters] = useState(initialFilters);
  const [editId, setEditId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [, startTransition] = useTransition();

  const purchasesByDate = useMemo(() => {
    const map = new Map<string, { modelId: string; modelName: string; qty: number; dealerTotal: number; crossQty: number }[]>();
    for (const p of initialPurchases) {
      if (!map.has(p.purchaseDate)) map.set(p.purchaseDate, []);
      const list = map.get(p.purchaseDate)!;
      const entry = list.find((e) => e.modelId === p.modelId);
      if (entry) {
        entry.qty += p.quantity;
        entry.dealerTotal += p.unitDealerPrice * p.quantity;
        if (p.source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN) entry.crossQty += p.quantity;
      } else {
        list.push({
          modelId: p.modelId,
          modelName: p.modelName,
          qty: p.quantity,
          dealerTotal: p.unitDealerPrice * p.quantity,
          crossQty: p.source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN ? p.quantity : 0,
        });
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, models]) => ({
        date,
        models: models.sort((a, b) => a.modelName.localeCompare(b.modelName)),
        totalQty: models.reduce((s, m) => s + m.qty, 0),
        totalValue: models.reduce((s, m) => s + m.dealerTotal, 0),
      }));
  }, [initialPurchases]);

  const updateFilter = (key: keyof typeof filters, value: string | undefined) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    setSelected(new Set());
    const search = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    router.replace(`/purchases${search.size ? `?${search}` : ""}`);
  };

  const handleDelete = (id: string, modelName: string) => {
    setPendingDelete({ id, label: modelName });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      const res = await deletePurchaseAction(id);
      if (res.error) { toast.error(res.error); return; }
      setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
      toast.success("Purchase deleted");
      router.refresh();
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    setPendingBulkDelete(true);
  };

  const confirmBulkDelete = () => {
    const ids = [...selected];
    setPendingBulkDelete(false);
    startTransition(async () => {
      const { deleted, blocked } = await bulkDeletePurchasesAction(ids);
      setSelected(new Set());
      if (blocked && blocked.length > 0) {
        toast.error(
          deleted > 0
            ? `${deleted} deleted. ${blocked.length} couldn't be deleted — units already activated.`
            : `Cannot delete — all selected purchases have activated units.`
        );
      } else {
        toast.success(`${deleted} purchase(s) deleted`);
      }
      router.refresh();
    });
  };

  const allIds = initialPurchases.map((p) => p.id);
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

  return (
    <div className="space-y-6">
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10 text-primary">
              <Trash2 className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle className="font-semibold">Delete Purchase</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <span className="font-medium text-foreground">{pendingDelete?.label}</span> purchase record permanently? Rows with activated units cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              <Trash2 className="size-4" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingBulkDelete} onOpenChange={(o) => { if (!o) setPendingBulkDelete(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10 text-primary">
              <Trash2 className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle className="font-semibold">
              Delete {selected.size} Purchase{selected.size > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Rows with activated units will be skipped automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete}>
              <Trash2 className="size-4" />
              Delete {selected.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground">
            Stock arriving at your dealer ID. 4% only triggers on activation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["records", "by-date"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 transition-colors ${
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {v === "records" ? "Records" : "By Date"}
              </button>
            ))}
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button disabled={!hasDealer || models.length === 0}>
                <Plus className="size-4" />
                Add Purchase
              </Button>
            }
          />
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add Purchase</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <Tabs defaultValue="single">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single">Single line</TabsTrigger>
                  <TabsTrigger value="bulk">Bulk invoice</TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="pt-3">
                  <PurchaseForm
                    models={models}
                    onSuccess={() => {
                      setOpen(false);
                      toast.success("Purchase added");
                      router.refresh();
                    }}
                  />
                </TabsContent>
                <TabsContent value="bulk" className="pt-3">
                  <BulkInvoiceForm
                    models={models}
                    onSuccess={() => {
                      setOpen(false);
                      router.refresh();
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      {!hasDealer ? (
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <AlertCircle className="size-5 text-amber-500" />
            <CardTitle>No active Dealer ID</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Create a Dealer ID first on the IDs page.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
            <Select
              value={filters.source ?? "all"}
              onValueChange={(v) =>
                updateFilter("source", typeof v === "string" && v !== "all" ? v : undefined)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value={PURCHASE_SOURCE.REGULAR}>Regular</SelectItem>
                <SelectItem value={PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN}>
                  Cross-Region
                </SelectItem>
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

      {view === "by-date" ? (
        <div className="space-y-3">
          {purchasesByDate.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState icon={ShoppingCart} title="No purchases to display." description="Try adjusting the filters." />
              </CardContent>
            </Card>
          ) : purchasesByDate.map(({ date, models, totalQty, totalValue }) => (
            <Card key={date}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {purchaseDateLabel(date)}
                  </CardTitle>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {totalQty} units · {formatPKR(totalValue)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {models.map((m) => (
                      <TableRow key={m.modelId}>
                        <TableCell className="py-2 font-medium">{m.modelName}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{m.qty} units</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{formatPKR(m.dealerTotal)}</TableCell>
                        <TableCell className="py-2 text-right">
                          {m.crossQty > 0 ? (
                            <StatusBadge status="neutral" label={`${m.crossQty} cross-region`} />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {view === "records" ? (
      <Card>
        {someSelected && (
          <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 bg-muted/50">
            <span className="text-sm font-medium">
              <CheckSquare className="mr-1.5 inline size-4 text-primary" />
              {selected.size} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={handleBulkDelete}>
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
                  <TableHead className="w-10 pl-4">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer rounded border-border accent-primary"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Dealer ₨</TableHead>
                  <TableHead className="text-right">Total ₨</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState icon={ShoppingCart} title="No purchases yet for this dealer ID." description="Add a purchase to begin tracking stock." />
                    </TableCell>
                  </TableRow>
                ) : (
                  initialPurchases.map((p) => {
                    if (editId === p.id) {
                      return (
                        <EditPurchaseRow
                          key={p.id}
                          row={p}
                          onDone={onEditDone}
                          onCancel={() => setEditId(null)}
                        />
                      );
                    }
                    return (
                      <TableRow
                        key={p.id}
                        data-selected={selected.has(p.id)}
                        className="data-[selected=true]:bg-primary/5"
                      >
                        <TableCell className="pl-4">
                          <input
                            type="checkbox"
                            className="size-4 cursor-pointer rounded border-border accent-primary"
                            checked={selected.has(p.id)}
                            onChange={() => toggleOne(p.id)}
                            aria-label="Select row"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{p.modelName}</TableCell>
                        <TableCell className="text-right"><DataValue value={p.quantity} /></TableCell>
                        <TableCell className="text-right">
                          <DataValue value={p.unitDealerPrice} format="currency" />
                        </TableCell>
                        <TableCell className="text-right">
                          <DataValue value={p.unitDealerPrice * p.quantity} format="currency" />
                        </TableCell>
                        <TableCell>{formatDate(p.purchaseDate)}</TableCell>
                        <TableCell>
                          {p.source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN ? (
                            <StatusBadge status="neutral" label="Cross-Region" />
                          ) : (
                            <StatusBadge status="confirmed" label="Regular" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit"
                              onClick={() => setEditId(p.id)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete"
                              onClick={() => handleDelete(p.id, p.modelName)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}

function purchaseDateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  if (dateStr === dayBefore) return "Day before yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
}

function EditPurchaseRow({
  row,
  onDone,
  onCancel,
}: {
  row: PurchaseRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<PurchaseFormState, FormData>(
    updatePurchaseAction,
    {}
  );
  const [qty, setQty] = useState(String(row.quantity));
  const [dealerPrice, setDealerPrice] = useState(String(row.unitDealerPrice));
  const [invoicePrice, setInvoicePrice] = useState(String(row.unitInvoicePrice));
  const [purchaseDate, setPurchaseDate] = useState(row.purchaseDate);
  const [source, setSource] = useState(row.source);

  useEffect(() => {
    if (state.ok) { toast.success("Purchase updated"); onDone(); }
    else if (state.error) toast.error(state.error);
  }, [state, onDone]);

  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={8} className="p-2">
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={row.id} />
          <span className="min-w-[80px] text-sm font-medium">{row.modelName}</span>
          <Input
            name="quantity"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
            className="w-20"
            placeholder="Qty"
          />
          <Input
            name="unitDealerPrice"
            type="number"
            step="any"
            min={0}
            value={dealerPrice}
            onChange={(e) => setDealerPrice(e.target.value)}
            required
            className="w-28"
            placeholder="Dealer ₨"
          />
          <Input
            name="unitInvoicePrice"
            type="number"
            step="any"
            min={0}
            value={invoicePrice}
            onChange={(e) => setInvoicePrice(e.target.value)}
            required
            className="w-28"
            placeholder="Invoice ₨"
          />
          <Input
            name="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            required
            className="w-36"
          />
          <select
            name="source"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value={PURCHASE_SOURCE.REGULAR}>Regular</option>
            <option value={PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN}>Cross-Region</option>
          </select>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

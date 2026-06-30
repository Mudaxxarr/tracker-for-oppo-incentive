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
import { DealerPurchaseForm } from "./dealer-purchase-form";
import { DealerBulkInvoiceForm } from "./dealer-bulk-invoice-form";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatDate, formatPKR } from "@/lib/format";
import { Plus, Trash2, AlertCircle, ShoppingCart } from "lucide-react";
import { deleteDealerPurchaseAction } from "./actions";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { PurchaseRow } from "@/lib/db/queries/purchases";

interface Props {
  models: ModelWithCurrentPrice[];
  initialPurchases: PurchaseRow[];
  initialFilters: { modelId?: string; source?: string; from?: string; to?: string };
  hasDealer: boolean;
  dealerId: string | null;
  tenantId: string;
  role: "admin" | "exec";
  backdateDays: number;
  canBulk: boolean;
}

export function DealerPurchasesClient({ models, initialPurchases, initialFilters, hasDealer, dealerId, tenantId, role, backdateDays, canBulk }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [, startTransition] = useTransition();

  const updateFilter = (key: keyof typeof filters, value: string | undefined) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    const search = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    router.replace(`/dealer/purchases${search.size ? `?${search}` : ""}`);
  };

  const handleDelete = (id: string, modelName: string) => {
    if (!confirm(`Delete this ${modelName} purchase row? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteDealerPurchaseAction(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Purchase deleted");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground">
            Stock arriving at your dealer ID. 4% only triggers on activation.
          </p>
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
                <TabsList className={cn("grid w-full", canBulk ? "grid-cols-2" : "grid-cols-1")}>
                  <TabsTrigger value="single">Single line</TabsTrigger>
                  {canBulk && <TabsTrigger value="bulk">Bulk invoice</TabsTrigger>}
                </TabsList>
                <TabsContent value="single" className="pt-3">
                  <DealerPurchaseForm
                    models={models}
                    dealerId={dealerId ?? ""}
                    tenantId={tenantId}
                    role={role}
                    backdateDays={backdateDays}
                    onSuccess={() => {
                      setOpen(false);
                      toast.success("Purchase added");
                      router.refresh();
                    }}
                  />
                </TabsContent>
                {canBulk && (
                  <TabsContent value="bulk" className="pt-3">
                    <DealerBulkInvoiceForm
                      models={models}
                      onSuccess={() => {
                        setOpen(false);
                        router.refresh();
                      }}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </SheetContent>
        </Sheet>
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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Dealer ₨</TableHead>
                  <TableHead className="text-right">Total ₨</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState icon={ShoppingCart} title="No purchases yet for this dealer ID." description="Add a purchase to begin tracking stock." />
                    </TableCell>
                  </TableRow>
                ) : (
                  initialPurchases.map((p) => (
                    <TableRow key={p.id}>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={() => handleDelete(p.id, p.modelName)}
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
    </div>
  );
}

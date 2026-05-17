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
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { deletePurchaseAction } from "./actions";
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
  const [filters, setFilters] = useState(initialFilters);
  const [, startTransition] = useTransition();

  const updateFilter = (key: keyof typeof filters, value: string | undefined) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    const search = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    router.replace(`/purchases${search.size ? `?${search}` : ""}`);
  };

  const handleDelete = (id: string, modelName: string) => {
    if (!confirm(`Delete this ${modelName} purchase row? This cannot be undone.`)) return;
    startTransition(async () => {
      await deletePurchaseAction(id);
      toast.success("Purchase deleted");
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Purchases</h1>
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
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No purchases yet for this dealer ID.
                    </TableCell>
                  </TableRow>
                ) : (
                  initialPurchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.modelName}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPKR(p.unitDealerPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPKR(p.unitDealerPrice * p.quantity)}
                      </TableCell>
                      <TableCell>{formatDate(p.purchaseDate)}</TableCell>
                      <TableCell>
                        {p.source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN ? (
                          <Badge variant="secondary">Cross-Region</Badge>
                        ) : (
                          <Badge>Regular</Badge>
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

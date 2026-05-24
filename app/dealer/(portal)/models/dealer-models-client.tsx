"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createDealerModelAction, deleteDealerModelAction, type ModelFormState } from "./actions";
import { DealerManageModelSheet } from "./dealer-manage-sheet";
import { formatDate, formatPKR } from "@/lib/format";
import { Plus, Settings2, Trash2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { ModelPriceHistory } from "@/lib/db/schema";

interface Props {
  models: ModelWithCurrentPrice[];
  history: Record<string, ModelPriceHistory[]>;
}

export function DealerModelsClient({ models, history }: Props) {
  const router = useRouter();
  const [createState, createAction, creating] = useActionState<ModelFormState, FormData>(
    createDealerModelAction,
    {},
  );
  const [, startTransition] = useTransition();
  const [manageId, setManageId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (createState.ok) {
      toast.success("Model added");
      setAddOpen(false);
      router.refresh();
    } else if (createState.error) {
      toast.error(createState.error);
    }
  }, [createState, router]);

  const onDelete = (id: string, name: string) => {
    if (
      !confirm(
        `Delete "${name}"? This permanently removes the model and its price history.\n\nIt will refuse if any purchases or activations still reference it.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteDealerModelAction(id);
      if (r.ok) {
        toast.success("Model deleted");
        router.refresh();
      } else {
        toast.error(r.error ?? "Delete failed");
      }
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const managed = manageId ? models.find((m) => m.id === manageId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Models</h1>
          <p className="text-sm text-muted-foreground">
            Master catalog. Price changes are applied to all dealer portals.
          </p>
        </div>
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger
            render={
              <Button>
                <Plus className="size-4" />
                Add Model
              </Button>
            }
          />
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add Model</SheetTitle>
            </SheetHeader>
            <form action={createAction} className="space-y-4 p-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Model name</label>
                <Input name="name" required maxLength={160} placeholder="e.g., OPPO A18 4+128" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">SKU (optional)</label>
                <Input name="sku" maxLength={80} placeholder="e.g., A18-4-128" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Dealer price (PKR)</label>
                  <Input name="dealerPrice" type="number" min={0} step="any" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Invoice price (PKR)</label>
                  <Input name="invoicePrice" type="number" min={0} step="any" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Effective from</label>
                <Input name="effectiveFrom" type="date" defaultValue={today} required />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Saving…" : "Save Model"}
              </Button>
              <p className="text-xs text-muted-foreground">
                You can add additional price changes later via the Manage button.
              </p>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {models.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Smartphone className="size-10 text-muted-foreground" />
            <h2 className="text-base font-medium">No models yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add the OPPO models you stock — name, SKU, current dealer and invoice price.
            </p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add your first model
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Dealer ₨</TableHead>
                    <TableHead className="text-right">Invoice ₨</TableHead>
                    <TableHead className="text-right">Price entries</TableHead>
                    <TableHead></TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((m) => {
                    const h = history[m.id] ?? [];
                    const lastChange = h[0]?.effectiveFrom;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {m.sku ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.dealerPrice != null ? formatPKR(m.dealerPrice) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.invoicePrice != null ? formatPKR(m.invoicePrice) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                          {h.length}{" "}
                          {lastChange ? (
                            <span className="text-[10px]">· last {formatDate(lastChange)}</span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {m.isActive ? null : <Badge variant="secondary">Inactive</Badge>}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Manage"
                            onClick={() => setManageId(m.id)}
                          >
                            <Settings2 className="size-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete"
                            onClick={() => onDelete(m.id, m.name)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {managed ? (
        <DealerManageModelSheet
          model={managed}
          history={history[managed.id] ?? []}
          onClose={() => setManageId(null)}
        />
      ) : null}
    </div>
  );
}

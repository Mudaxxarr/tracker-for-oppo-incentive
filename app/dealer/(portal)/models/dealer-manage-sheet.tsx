"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addDealerPriceEntryAction,
  deleteDealerPriceEntryAction,
  updateDealerModelAction,
  updateDealerPriceEntryAction,
  type ModelFormState,
} from "./actions";
import { formatDate, formatPKR } from "@/lib/format";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { ModelPriceHistory } from "@/lib/db/schema";

interface Props {
  model: ModelWithCurrentPrice;
  history: ModelPriceHistory[];
  onClose: () => void;
}

export function DealerManageModelSheet({ model, history, onClose }: Props) {
  const [name, setName] = useState(model.name);
  const [sku, setSku] = useState(model.sku ?? "");
  const [isActive, setIsActive] = useState(model.isActive);
  useEffect(() => {
    setName(model.name);
    setSku(model.sku ?? "");
    setIsActive(model.isActive);
  }, [model.id, model.name, model.sku, model.isActive]);

  const today = new Date().toISOString().slice(0, 10);
  const [newDealer, setNewDealer] = useState<string>(
    model.dealerPrice != null ? String(model.dealerPrice) : "",
  );
  const [newInvoice, setNewInvoice] = useState<string>(
    model.invoicePrice != null ? String(model.invoicePrice) : "",
  );
  const [newEffective, setNewEffective] = useState<string>(today);
  useEffect(() => {
    setNewDealer(model.dealerPrice != null ? String(model.dealerPrice) : "");
    setNewInvoice(model.invoicePrice != null ? String(model.invoicePrice) : "");
    setNewEffective(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id]);

  const router = useRouter();
  const [updateState, updateAction, updating] = useActionState<ModelFormState, FormData>(
    updateDealerModelAction,
    {},
  );
  const [priceState, priceAction, pricePending] = useActionState<ModelFormState, FormData>(
    addDealerPriceEntryAction,
    {},
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (updateState.ok) {
      toast.success("Model updated");
      router.refresh();
    } else if (updateState.error) {
      toast.error(updateState.error);
    }
  }, [updateState, router]);

  useEffect(() => {
    if (priceState.ok) {
      toast.success("Price change recorded");
      router.refresh();
    } else if (priceState.error) {
      toast.error(priceState.error);
    }
  }, [priceState, router]);

  const onDeletePriceEntry = (priceId: string, effectiveFrom: string) => {
    if (history.length <= 1) {
      toast.error("Can't delete the only price entry — add a new one first");
      return;
    }
    if (
      !confirm(
        `Delete price entry effective ${formatDate(effectiveFrom)}? Timeline will be re-stitched automatically.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteDealerPriceEntryAction({ modelId: model.id, priceId });
      if (r.ok) {
        toast.success("Price entry deleted");
        router.refresh();
      } else {
        toast.error(r.error ?? "Delete failed");
      }
    });
  };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" key={model.id}>
        <SheetHeader>
          <SheetTitle>Manage model</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 p-4">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Details</h3>
            <form action={updateAction} className="space-y-3">
              <input type="hidden" name="id" value={model.id} />
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Model name</label>
                <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">SKU</label>
                <Input name="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  value="on"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="size-4"
                />
                Active (offered to forms)
              </label>
              <Button type="submit" disabled={updating}>
                {updating ? "Saving…" : "Save details"}
              </Button>
            </form>
          </section>

          <hr />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Record a price change</h3>
            <form action={priceAction} className="grid grid-cols-2 gap-3">
              <input type="hidden" name="modelId" value={model.id} />
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Dealer price (PKR)</label>
                <Input
                  name="dealerPrice"
                  type="number"
                  min={0}
                  step="any"
                  value={newDealer}
                  onChange={(e) => setNewDealer(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Invoice price (PKR)</label>
                <Input
                  name="invoicePrice"
                  type="number"
                  min={0}
                  step="any"
                  value={newInvoice}
                  onChange={(e) => setNewInvoice(e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs text-muted-foreground">Effective from</label>
                <Input
                  name="effectiveFrom"
                  type="date"
                  value={newEffective}
                  onChange={(e) => setNewEffective(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Pick any date — past or future. Existing entries are re-stitched automatically.
                </p>
              </div>
              <Button type="submit" className="col-span-2" disabled={pricePending}>
                {pricePending ? "Saving…" : "Add price change"}
              </Button>
            </form>
          </section>

          <hr />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Price history</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No price entries yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right">Dealer ₨</TableHead>
                      <TableHead className="text-right">Invoice ₨</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <DealerPriceRow
                        key={h.id}
                        modelId={model.id}
                        row={h}
                        onDelete={() => onDeletePriceEntry(h.id, h.effectiveFrom)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface PriceRowProps {
  modelId: string;
  row: ModelPriceHistory;
  onDelete: () => void;
}

function DealerPriceRow({ modelId, row, onDelete }: PriceRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [savePending, startSave] = useTransition();
  const [dealer, setDealer] = useState(String(row.dealerPrice));
  const [invoice, setInvoice] = useState(String(row.invoicePrice));
  const [from, setFrom] = useState(row.effectiveFrom);

  useEffect(() => {
    setDealer(String(row.dealerPrice));
    setInvoice(String(row.invoicePrice));
    setFrom(row.effectiveFrom);
  }, [row.id, row.dealerPrice, row.invoicePrice, row.effectiveFrom]);

  const cancel = () => {
    setEditing(false);
    setDealer(String(row.dealerPrice));
    setInvoice(String(row.invoicePrice));
    setFrom(row.effectiveFrom);
  };

  const save = () => {
    const d = Number(dealer);
    const i = Number(invoice);
    if (!Number.isFinite(d) || d < 0) return toast.error("Dealer price invalid");
    if (!Number.isFinite(i) || i < 0) return toast.error("Invoice price invalid");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return toast.error("Effective date invalid");
    startSave(async () => {
      const r = await updateDealerPriceEntryAction({
        modelId,
        priceId: row.id,
        dealerPrice: d,
        invoicePrice: i,
        effectiveFrom: from,
      });
      if (r.ok) {
        toast.success("Price updated");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(r.error ?? "Update failed");
      }
    });
  };

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={2}>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 w-[150px]"
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            min={0}
            step="any"
            value={dealer}
            onChange={(e) => setDealer(e.target.value)}
            className="h-8 text-right"
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            min={0}
            step="any"
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
            className="h-8 text-right"
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Save" onClick={save} disabled={savePending}>
              <Check className="size-4 text-emerald-600" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancel" onClick={cancel} disabled={savePending}>
              <X className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="text-xs">{formatDate(row.effectiveFrom)}</TableCell>
      <TableCell className="text-xs">
        {row.effectiveTo ? formatDate(row.effectiveTo) : <span className="text-emerald-600">current</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatPKR(row.dealerPrice)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatPKR(row.invoicePrice)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

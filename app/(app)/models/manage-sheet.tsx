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
  addPriceEntryAction,
  deletePriceEntryAction,
  updateModelAction,
  updatePriceEntryAction,
  type ModelFormState,
} from "./actions";
import { formatDate, formatPKR } from "@/lib/format";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { ModelPriceHistory } from "@/lib/db/schema";
import type { RebateRow } from "@/lib/db/queries/rebates";

interface Props {
  model: ModelWithCurrentPrice;
  history: ModelPriceHistory[];
  rebates: RebateRow[];
  onClose: () => void;
}

export function ManageModelSheet({ model, history, rebates, onClose }: Props) {
  // Controlled state — re-syncs whenever the active model changes (fixes the
  // "default value of an uncontrolled FieldControl" warning).
  const [name, setName] = useState(model.name);
  const [sku, setSku] = useState(model.sku ?? "");
  const [isActive, setIsActive] = useState(model.isActive);
  useEffect(() => {
    setName(model.name);
    setSku(model.sku ?? "");
    setIsActive(model.isActive);
  }, [model.id, model.name, model.sku, model.isActive]);

  // New-price form (always controlled).
  const today = new Date().toISOString().slice(0, 10);
  const [newDealer, setNewDealer] = useState<string>(
    model.dealerPrice != null ? String(model.dealerPrice) : ""
  );
  const [newInvoice, setNewInvoice] = useState<string>(
    model.invoicePrice != null ? String(model.invoicePrice) : ""
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
    updateModelAction,
    {}
  );
  const [priceState, priceAction, pricePending] = useActionState<ModelFormState, FormData>(
    addPriceEntryAction,
    {}
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
    const linkedRebates = rebates.filter((r) => r.priceHistoryId === priceId);
    const linkedTotal = linkedRebates.reduce((s, r) => s + r.totalRebateAmount, 0);
    const rebateWarning =
      linkedRebates.length > 0
        ? `\n\n⚠️ WARNING: This price drop has ${linkedRebates.length} rebate record(s) worth PKR ${linkedTotal.toLocaleString()}. Deleting this entry will also permanently delete those rebates.`
        : "";
    if (
      !confirm(
        `Delete price entry effective ${formatDate(effectiveFrom)}? Timeline will be re-stitched automatically.${rebateWarning}`
      )
    )
      return;
    startTransition(async () => {
      const r = await deletePriceEntryAction({ modelId: model.id, priceId });
      if (r.ok) {
        toast.success("Price entry deleted");
        router.refresh();
      } else {
        toast.error(r.error ?? "Delete failed");
      }
    });
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
        key={model.id}
      >
        <SheetHeader>
          <SheetTitle>Manage model</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 p-4">
          {/* Edit name + SKU */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Details</h3>
            <form action={updateAction} className="space-y-3">
              <input type="hidden" name="id" value={model.id} />
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Model name</label>
                <Input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">SKU</label>
                <Input
                  name="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
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

          {/* Add new price entry */}
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

          {/* Price history (with inline edit) */}
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
                      <PriceRow
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

          {rebates.length > 0 && (
            <>
              <hr />
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">Rebate history</h3>
                  <p className="text-xs text-muted-foreground">
                    Automatically calculated when dealer price dropped. Company adjusts this into your ledger.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Dealer</TableHead>
                        <TableHead className="text-right">Old ₨</TableHead>
                        <TableHead className="text-right">New ₨</TableHead>
                        <TableHead className="text-right">Per unit</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right font-semibold">Total ₨</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rebates.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{formatDate(r.rebateDate)}</TableCell>
                          <TableCell className="text-xs">{r.dealerName}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{formatPKR(r.oldDealerPrice)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{formatPKR(r.newDealerPrice)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs text-amber-600">−{formatPKR(r.rebatePerUnit)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{r.eligibleQty}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs font-semibold text-emerald-600">{formatPKR(r.totalRebateAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Grand total: <span className="font-semibold text-emerald-700">
                    {formatPKR(rebates.reduce((s, r) => s + r.totalRebateAmount, 0))}
                  </span>
                </p>
              </section>
            </>
          )}
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

function PriceRow({ modelId, row, onDelete }: PriceRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [savePending, startSave] = useTransition();
  const [dealer, setDealer] = useState(String(row.dealerPrice));
  const [invoice, setInvoice] = useState(String(row.invoicePrice));
  const [from, setFrom] = useState(row.effectiveFrom);

  // Re-sync local state if the row prop changes (after a refresh).
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
      const r = await updatePriceEntryAction({
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
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Save"
              onClick={save}
              disabled={savePending}
            >
              <Check className="size-4 text-emerald-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel"
              onClick={cancel}
              disabled={savePending}
            >
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
        {row.effectiveTo ? (
          formatDate(row.effectiveTo)
        ) : (
          <span className="text-emerald-600">current</span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatPKR(row.dealerPrice)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatPKR(row.invoicePrice)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" />
          </Button>
          {row.effectiveTo === null && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete"
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

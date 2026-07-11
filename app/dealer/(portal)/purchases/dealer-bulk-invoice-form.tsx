"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { createDealerBulkPurchasesAction, getPriceOnDateForDealer, type BulkInvoiceState } from "./actions";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { formatPKR } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";

interface Props {
  models: ModelWithCurrentPrice[];
  onSuccess?: () => void;
}

interface Line {
  key: string;
  modelId: string;
  quantity: string;
  unitDealerPrice: string;
  unitInvoicePrice: string;
}

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  modelId: "",
  quantity: "1",
  unitDealerPrice: "",
  unitInvoicePrice: "",
});

const lineIsInvalid = (l: Line) =>
  !l.modelId ||
  !(Number(l.quantity) >= 1) ||
  l.unitDealerPrice.trim() === "" || !(Number(l.unitDealerPrice) >= 0) ||
  l.unitInvoicePrice.trim() === "" || !(Number(l.unitInvoicePrice) >= 0);

export function DealerBulkInvoiceForm({ models, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [state, action, pending] = useActionState<BulkInvoiceState, FormData>(
    createDealerBulkPurchasesAction,
    {},
  );
  const [, startTransition] = useTransition();
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [source, setSource] = useState<string>(PURCHASE_SOURCE.REGULAR);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  useEffect(() => {
    if (state.ok) {
      toast.success(`Invoice recorded: ${state.inserted} line(s)`);
      onSuccess?.(); // closes the sheet → form unmounts, so no manual reset needed
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);

  const fillPriceForLine = async (idx: number, modelId: string, date: string) => {
    if (!modelId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const p = await getPriceOnDateForDealer(modelId, date);
    if (!p) return;
    setLines((prev) =>
      prev.map((l, i) =>
        i !== idx
          ? l
          : {
              ...l,
              unitDealerPrice: l.unitDealerPrice || String(p.dealerPrice),
              unitInvoicePrice: l.unitInvoicePrice || String(p.invoicePrice),
            },
      ),
    );
  };

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    if (patch.modelId) fillPriceForLine(idx, patch.modelId, purchaseDate);
  };

  useEffect(() => {
    lines.forEach((l, i) => {
      if (l.modelId) fillPriceForLine(i, l.modelId, purchaseDate);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseDate]);

  const lineTotal = (l: Line) => Number(l.unitDealerPrice || 0) * Number(l.quantity || 0);
  const grandTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);

  // No <form>/native validation — validate in JS and ALWAYS give feedback so a
  // click can never silently do nothing. Dispatch via startTransition (same as
  // the single-purchase form).
  const submit = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      toast.error("Pehle purchase ki date chunein.");
      return;
    }
    if (lines.length === 0 || lines.some(lineIsInvalid)) {
      toast.error("Har line mein Model, Qty aur dono prices (Dealer ₨ / Invoice ₨) bharna zaroori hai.");
      return;
    }
    const payload = {
      purchaseDate,
      source,
      invoiceNumber: invoiceNumber.trim(),
      notes: notes.trim() || undefined,
      lines: lines.map((l) => ({
        modelId: l.modelId,
        quantity: Number(l.quantity),
        unitDealerPrice: Number(l.unitDealerPrice),
        unitInvoicePrice: Number(l.unitInvoicePrice),
      })),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    startTransition(() => action(fd));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Invoice # <span className="text-muted-foreground">(optional)</span></label>
          <Input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="e.g., INV-2026-0123"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date</label>
          <Input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            max={today}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Source</label>
        <Select value={source} onValueChange={(v) => typeof v === "string" && setSource(v)}>
          <SelectTrigger className="w-full">
            <span>
              {source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN
                ? "Cross-Region Transfer-In"
                : "Regular"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PURCHASE_SOURCE.REGULAR}>Regular</SelectItem>
            <SelectItem value={PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN}>
              Cross-Region Transfer-In
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Lines</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((p) => [...p, newLine()])}
          >
            <Plus className="size-4" /> Add line
          </Button>
        </div>

        <div className="space-y-3">
          {lines.map((l, idx) => {
            const m = models.find((x) => x.id === l.modelId);
            return (
              <div key={l.key} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs text-muted-foreground">Model</label>
                    <Select
                      value={l.modelId}
                      onValueChange={(v) => typeof v === "string" && updateLine(idx, { modelId: v })}
                    >
                      <SelectTrigger className="w-full">
                        <span className={m ? "" : "text-muted-foreground"}>
                          {m?.name ?? "Choose model…"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((mm) => (
                          <SelectItem key={mm.id} value={mm.id}>
                            <span className="flex w-full items-center justify-between gap-3">
                              <span>{mm.name}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {mm.dealerPrice != null ? formatPKR(mm.dealerPrice) : "no price"}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {lines.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove line"
                      onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Qty</label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={l.quantity}
                      onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Dealer ₨</label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={l.unitDealerPrice}
                      onChange={(e) => updateLine(idx, { unitDealerPrice: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Invoice ₨</label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={l.unitInvoicePrice}
                      onChange={(e) => updateLine(idx, { unitInvoicePrice: e.target.value })}
                    />
                  </div>
                </div>
                {l.modelId && Number(l.quantity) > 0 ? (
                  <p className="text-right text-xs tabular-nums text-muted-foreground">
                    Subtotal: {formatPKR(lineTotal(l))}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {grandTotal > 0 ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
          <span className="text-muted-foreground">Grand total</span>
          <span className="tabular-nums">{formatPKR(grandTotal)}</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes (optional)</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Distributor, region, etc."
          maxLength={500}
        />
      </div>

      <Button type="button" onClick={submit} className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Record Invoice"}
      </Button>
    </div>
  );
}

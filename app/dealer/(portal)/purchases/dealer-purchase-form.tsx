"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { createDealerPurchaseAction, getPriceOnDateForDealer, type PurchaseFormState } from "./actions";
import { PURCHASE_SOURCE } from "@/lib/constants";
import { formatPKR } from "@/lib/format";
import { addToQueue } from "@/lib/offline-queue";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import { HelpTip } from "@/components/dealer/help-tip";

interface Props {
  models: ModelWithCurrentPrice[];
  dealerId: string;
  tenantId: string;
  role: "admin" | "exec";
  backdateDays: number;
  onSuccess?: () => void;
}

export function DealerPurchaseForm({ models, dealerId, tenantId, role, backdateDays, onSuccess }: Props) {
  const [state, action, pending] = useActionState<PurchaseFormState, FormData>(
    createDealerPurchaseAction,
    {},
  );
  const [, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const minDate = new Date(Date.now() - backdateDays * 86400000).toISOString().slice(0, 10);
  const [modelId, setModelId] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(today);
  const [dealerPrice, setDealerPrice] = useState<string>("");
  const [invoicePrice, setInvoicePrice] = useState<string>("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [pricedAt, setPricedAt] = useState<{ dealer: number; invoice: number } | null>(null);
  const [source, setSource] = useState<string>(PURCHASE_SOURCE.REGULAR);

  const selected = useMemo(
    () => (modelId ? models.find((m) => m.id === modelId) : undefined),
    [models, modelId],
  );

  useEffect(() => {
    if (!modelId || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      setPricedAt(null);
      setPriceTouched(false);
      return;
    }
    let cancelled = false;
    // Reset priceTouched here so we don't need a separate effect that causes a second render
    setPriceTouched(false);
    getPriceOnDateForDealer(modelId, purchaseDate).then((p) => {
      if (cancelled) return;
      setPricedAt(p ? { dealer: p.dealerPrice, invoice: p.invoicePrice } : null);
      setDealerPrice(p ? String(p.dealerPrice) : "");
      setInvoicePrice(p ? String(p.invoicePrice) : "");
    });
    return () => { cancelled = true; };
  // priceTouched intentionally excluded — manual edits don't re-fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, purchaseDate]);

  useEffect(() => {
    if (state.ok) {
      setModelId("");
      setPurchaseDate(today);
      setDealerPrice("");
      setInvoicePrice("");
      setPriceTouched(false);
      setPricedAt(null);
      onSuccess?.();
    }
  }, [state.ok, onSuccess, today]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!navigator.onLine) {
      const fd = new FormData(e.currentTarget);
      const qty = Math.max(1, Number(fd.get("quantity")) || 1);
      const udp = Number(dealerPrice) || 0;
      const uip = Number(invoicePrice) || 0;
      await addToQueue({
        type: "purchase",
        portal: "dealer",
        role,
        tenantId,
        dealerId,
        modelId,
        modelName: selected?.name ?? modelId,
        quantity: qty,
        purchaseDate: purchaseDate,
        unitDealerPrice: udp,
        unitInvoicePrice: uip,
        source: source,
        referenceNote: String(fd.get("referenceNote") || "").trim() || undefined,
      });
      window.dispatchEvent(new Event("offlineQueueUpdated"));
      toast.success("Purchase saved offline — will sync when connected");
      setModelId("");
      setPurchaseDate(today);
      setDealerPrice("");
      setInvoicePrice("");
      setPriceTouched(false);
      setPricedAt(null);
      onSuccess?.();
      return;
    }
    startTransition(() => action(new FormData(e.currentTarget)));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="modelId" value={modelId} />

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Model</label>
        <Select value={modelId} onValueChange={(v) => typeof v === "string" && setModelId(v)}>
          <SelectTrigger className="w-full">
            <span className={selected ? "" : "text-muted-foreground"}>
              {selected?.name ?? "Search and select…"}
            </span>
          </SelectTrigger>
          <SelectContent>
            {models.filter((m) => m.isActive).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="flex w-full items-center justify-between gap-3">
                  <span>{m.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {m.dealerPrice != null ? formatPKR(m.dealerPrice) : "no price"}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.modelId ? (
          <p className="text-xs text-destructive">{state.fieldErrors.modelId}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Quantity</label>
          <Input name="quantity" type="number" min={1} step={1} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date</label>
          <Input
            name="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            min={minDate}
            max={today}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Unit Dealer Price (PKR)</label>
          <Input
            name="unitDealerPrice"
            type="number"
            min={0}
            step="any"
            value={dealerPrice}
            onChange={(e) => { setDealerPrice(e.target.value); setPriceTouched(true); }}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Unit Invoice Price (PKR)</label>
          <Input
            name="unitInvoicePrice"
            type="number"
            min={0}
            step="any"
            value={invoicePrice}
            onChange={(e) => { setInvoicePrice(e.target.value); setPriceTouched(true); }}
            required
          />
        </div>
      </div>

      {selected && pricedAt ? (
        <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          Dealer price effective on {purchaseDate}:{" "}
          <strong className="text-foreground">{formatPKR(pricedAt.dealer)}</strong>
        </p>
      ) : selected && !pricedAt ? (
        <p className="rounded-md border bg-amber-500/10 p-3 text-xs text-amber-700">
          No master price found for this model on {purchaseDate}. Enter the prices manually.
        </p>
      ) : null}

      <input type="hidden" name="source" value={source} />
      <div className="space-y-1.5">
        <label className="text-sm font-medium inline-flex items-center gap-1">
          Source <HelpTip term="cr-exposure" />
        </label>
        <Select value={source} onValueChange={(v) => typeof v === "string" && setSource(v)}>
          <SelectTrigger className="w-full">
            <span>
              {source === PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN
                ? "Cross-region stock (received from another region)"
                : "Regular"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PURCHASE_SOURCE.REGULAR}>Regular</SelectItem>
            <SelectItem value={PURCHASE_SOURCE.CROSS_REGION_TRANSFER_IN}>
              Cross-region stock (received from another region)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Reference note (optional)</label>
        <Input name="referenceNote" maxLength={500} placeholder="invoice #, distributor, etc." />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending || !modelId}>
        {pending ? "Saving…" : "Save Purchase"}
      </Button>
    </form>
  );
}

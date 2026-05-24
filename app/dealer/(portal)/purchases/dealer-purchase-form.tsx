"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";

interface Props {
  models: ModelWithCurrentPrice[];
  onSuccess?: () => void;
}

export function DealerPurchaseForm({ models, onSuccess }: Props) {
  const [state, action, pending] = useActionState<PurchaseFormState, FormData>(
    createDealerPurchaseAction,
    {},
  );
  const today = new Date().toISOString().slice(0, 10);
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
      return;
    }
    let cancelled = false;
    getPriceOnDateForDealer(modelId, purchaseDate).then((p) => {
      if (cancelled) return;
      setPricedAt(p ? { dealer: p.dealerPrice, invoice: p.invoicePrice } : null);
      if (!priceTouched) {
        setDealerPrice(p ? String(p.dealerPrice) : "");
        setInvoicePrice(p ? String(p.invoicePrice) : "");
      }
    });
    return () => { cancelled = true; };
  }, [modelId, purchaseDate, priceTouched]);

  useEffect(() => {
    setPriceTouched(false);
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

  return (
    <form action={action} className="space-y-4">
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

"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createPosSaleAction, type PosSaleState } from "./actions";
import { formatPKR } from "@/lib/format";
import { toast } from "sonner";
import type { StockRow } from "@/lib/db/queries/purchases";
import {
  Package,
  User,
  CheckCircle2,
  Download,
  ArrowLeft,
  ArrowRight,
  Receipt,
} from "lucide-react";

interface Props {
  stock: StockRow[];
  canReceipt: boolean;
}

type CustomerMode = "skip" | "new";

export function PosClient({ stock, canReceipt }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [modelId, setModelId] = useState("");
  const [imei, setImei] = useState("");

  // Step 2 state
  const [customerMode, setCustomerMode] = useState<CustomerMode>("skip");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCnic, setCustomerCnic] = useState("");

  const [state, action, pending] = useActionState<PosSaleState, FormData>(
    createPosSaleAction,
    {}
  );

  if (state.error && !pending) {
    toast.error(state.error);
  }

  const selectedStock = stock.find((s) => s.modelId === modelId);
  const availableStock = stock.filter((s) => s.quantity > 0);

  const handleBack = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleStep1Next = () => {
    if (!modelId) { toast.error("Select a model first"); return; }
    if (!selectedStock || selectedStock.quantity < 1) { toast.error("No stock available"); return; }
    setStep(2);
  };

  const handleStep2Next = () => {
    if (customerMode === "new") {
      if (!customerName.trim()) { toast.error("Enter customer name"); return; }
      if (!customerPhone.trim()) { toast.error("Enter customer phone"); return; }
    }
    setStep(3);
  };

  const handleNewSale = () => {
    setModelId("");
    setImei("");
    setCustomerMode("skip");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerCnic("");
    setStep(1);
    startTransition(() => router.refresh());
  };

  // Success screen
  if (state.activationId && !pending) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="text-center space-y-3">
          <CheckCircle2 className="size-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-semibold">Sale Complete!</h1>
          <p className="text-muted-foreground">
            {state.modelName} sold for {formatPKR(state.pricedAt ?? 0)}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3">
            {canReceipt && (
              <a
                href={`/api/dealer/receipt/${state.activationId}`}
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                <Button className="w-full" variant="default">
                  <Download className="size-4 mr-2" />
                  Download Receipt PDF
                </Button>
              </a>
            )}
            <Button className="w-full" variant="outline" onClick={handleNewSale}>
              <Receipt className="size-4 mr-2" />
              New Sale
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Receipt className="size-6 text-primary" />
          Quick Sell
        </h1>
        <p className="text-sm text-muted-foreground">Log a sale and generate a receipt.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {s}
            </div>
            {s < 3 && <div className={`flex-1 h-0.5 w-8 transition-colors ${step > s ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
        <span className="text-sm text-muted-foreground ml-2">
          {step === 1 ? "Pick Model" : step === 2 ? "Customer" : "Confirm"}
        </span>
      </div>

      {/* Step 1: Model */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="size-4" />
              Select Model
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Model *</label>
              <Select value={modelId} onValueChange={(v) => { if (v) setModelId(v); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a model in stock…" />
                </SelectTrigger>
                <SelectContent>
                  {availableStock.map((s) => (
                    <SelectItem key={s.modelId} value={s.modelId}>
                      <span>{s.modelName}</span>
                      <span className="ml-2 text-muted-foreground text-xs">({s.quantity} in stock)</span>
                    </SelectItem>
                  ))}
                  {availableStock.length === 0 && (
                    <SelectItem value="__none" disabled>No stock available</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {selectedStock && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline">{selectedStock.quantity} in stock</Badge>
                  {selectedStock.dealerPrice && (
                    <Badge variant="secondary">Price: {formatPKR(selectedStock.dealerPrice)}</Badge>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">IMEI <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder="14–16 digit IMEI"
                className="mt-1 font-mono"
                maxLength={16}
              />
            </div>
            <Button className="w-full" onClick={handleStep1Next} disabled={!modelId}>
              Next — Customer
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Customer */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4" />
              Customer <span className="text-muted-foreground font-normal text-sm">(optional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={customerMode === "skip" ? "default" : "outline"}
                size="sm"
                onClick={() => setCustomerMode("skip")}
              >
                No customer
              </Button>
              <Button
                type="button"
                variant={customerMode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => setCustomerMode("new")}
              >
                New customer
              </Button>
            </div>

            {customerMode === "new" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone *</label>
                  <Input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="03XX-XXXXXXX" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">CNIC <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input value={customerCnic} onChange={(e) => setCustomerCnic(e.target.value)} placeholder="XXXXX-XXXXXXX-X" className="mt-1" />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="size-4 mr-2" />
                Back
              </Button>
              <Button className="flex-1" onClick={handleStep2Next}>
                Next — Confirm
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <form action={action}>
          <input type="hidden" name="modelId" value={modelId} />
          <input type="hidden" name="imei" value={imei} />
          {customerMode === "new" && (
            <>
              <input type="hidden" name="customerName" value={customerName} />
              <input type="hidden" name="customerPhone" value={customerPhone} />
              <input type="hidden" name="customerCnic" value={customerCnic} />
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-500" />
                Confirm Sale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium">{selectedStock?.modelName}</span>
                </div>
                {imei && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IMEI</span>
                    <span className="font-mono text-xs">{imei}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-semibold text-primary">{selectedStock?.dealerPrice ? formatPKR(selectedStock.dealerPrice) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{new Date().toLocaleDateString("en-PK")}</span>
                </div>
                {customerMode === "new" && (
                  <>
                    <div className="border-t pt-2 mt-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium">{customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span>{customerPhone}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ArrowLeft className="size-4 mr-2" />
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? "Processing…" : "Confirm Sale"}
                  <CheckCircle2 className="size-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}

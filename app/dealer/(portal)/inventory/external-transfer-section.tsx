"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ArrowDownLeft, ArrowUpRight, Pencil, Trash2, Plus, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  dealerCreateExternalTransferAction,
  dealerUpdateExternalTransferAction,
  dealerDeleteExternalTransferAction,
} from "./actions";
import type { ExternalTransferRow } from "@/lib/db/queries/external-transfers";

interface ModelOption { id: string; name: string }

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * External Transfer — record our stock moving to/from an out-of-system dealer.
 * Rendered only for the main dealer (admin); the server action enforces the same.
 */
export function ExternalTransferSection({
  models, transfers,
}: { models: ModelOption[]; transfers: ExternalTransferRow[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalTransferRow | null>(null);

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">External Transfer</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Move stock to or from a dealer in another city. Stock only — no incentive is affected.
          </p>
        </div>
        <Button
          variant={open ? "ghost" : "outline"}
          size="sm"
          onClick={() => { setOpen((v) => !v); setEditing(null); }}
        >
          {open ? <><X className="mr-1 size-3.5" />Close</> : <><Plus className="mr-1 size-3.5" />New transfer</>}
        </Button>
      </header>

      {open && (
        <div className="border-t px-5 py-4">
          <ExternalTransferForm
            key={editing?.id ?? "new"}
            models={models}
            editing={editing}
            onDone={() => { setOpen(false); setEditing(null); }}
          />
        </div>
      )}

      {transfers.length > 0 && (
        <div className="border-t">
          <ul className="divide-y">
            {transfers.map((t) => (
              <ExternalTransferItem
                key={t.id}
                t={t}
                onEdit={() => { setEditing(t); setOpen(true); }}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ExternalTransferItem({ t, onEdit }: { t: ExternalTransferRow; onEdit: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isIn = t.direction === "IN";

  const remove = () => {
    if (!confirm("Delete this external transfer? Stock will adjust back.")) return;
    start(async () => {
      const res = await dealerDeleteExternalTransferAction(t.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("External transfer deleted");
      router.refresh();
    });
  };

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${isIn ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
        {isIn ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {isIn ? "Transfer In" : "Transfer Out"} · {t.quantity} × {t.modelName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {isIn ? "from" : "to"} {t.counterpartName}{t.counterpartCity ? `, ${t.counterpartCity}` : ""} · {formatDate(t.transferDate)}
          {t.note ? ` · ${t.note}` : ""}
        </p>
      </div>
      <Button variant="ghost" size="icon" className="size-7" aria-label="Edit" disabled={pending} onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label="Delete" disabled={pending} onClick={remove}>
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

function ExternalTransferForm({
  models, editing, onDone,
}: { models: ModelOption[]; editing: ExternalTransferRow | null; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [direction, setDirection] = useState<"IN" | "OUT">((editing?.direction as "IN" | "OUT") ?? "IN");
  const [modelId, setModelId] = useState(editing?.modelId ?? "");
  const [quantity, setQuantity] = useState(editing ? String(editing.quantity) : "");
  const [transferDate, setTransferDate] = useState(editing?.transferDate ?? todayStr());
  const [counterpartName, setCounterpartName] = useState(editing?.counterpartName ?? "");
  const [counterpartCity, setCounterpartCity] = useState(editing?.counterpartCity ?? "");
  const [note, setNote] = useState(editing?.note ?? "");

  const submit = () => {
    if (!modelId) { toast.error("Choose a model"); return; }
    if (!(Number(quantity) >= 1)) { toast.error("Quantity must be at least 1"); return; }
    if (!counterpartName.trim()) { toast.error("Enter the dealer's name"); return; }
    const fd = new FormData();
    if (editing) fd.set("id", editing.id);
    fd.set("modelId", modelId);
    fd.set("direction", direction);
    fd.set("quantity", quantity);
    fd.set("transferDate", transferDate);
    fd.set("counterpartName", counterpartName);
    fd.set("counterpartCity", counterpartCity);
    fd.set("note", note);
    start(async () => {
      const res = editing
        ? await dealerUpdateExternalTransferAction({}, fd)
        : await dealerCreateExternalTransferAction({}, fd);
      if (res.error) { toast.error(res.error); return; }
      toast.success(editing ? "External transfer updated" : "External transfer recorded");
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={direction === "IN" ? "default" : "outline"}
          className="justify-start gap-2"
          onClick={() => setDirection("IN")}
        >
          <ArrowDownLeft className="size-4" /> Transfer In
        </Button>
        <Button
          type="button"
          variant={direction === "OUT" ? "default" : "outline"}
          className="justify-start gap-2"
          onClick={() => setDirection("OUT")}
        >
          <ArrowUpRight className="size-4" /> Transfer Out
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Model</label>
          <Select value={modelId} onValueChange={(v) => setModelId(v ?? "")}>
            <SelectTrigger><span className="truncate">{models.find((m) => m.id === modelId)?.name ?? "Choose model"}</span></SelectTrigger>
            <SelectContent>
              {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Quantity</label>
          <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 12" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Dealer name</label>
          <Input value={counterpartName} onChange={(e) => setCounterpartName(e.target.value)} placeholder="e.g. Ali Mobiles" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">City (optional)</label>
          <Input value={counterpartCity} onChange={(e) => setCounterpartCity(e.target.value)} placeholder="e.g. Multan" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Note (optional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reference / reason" />
        </div>
      </div>

      <Button className="w-full" disabled={pending} onClick={submit}>
        {pending ? "Saving…" : editing ? "Save changes" : direction === "IN" ? "Record Transfer In" : "Record Transfer Out"}
      </Button>
    </div>
  );
}

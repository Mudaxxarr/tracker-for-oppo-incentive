"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  createDealerInterIdTransferAction,
  updateDealerTenantIdAction,
  acceptDealerTransferAction,
  rejectDealerTransferAction,
  editDealerTransferAction,
  deleteDealerTransferAction,
  type DealerIdFormState,
} from "./actions";
import { AddDealerIdForm } from "./add-id-form";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate, formatPKR } from "@/lib/format";
import { Lock, ArrowRightCircle, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { InterIdRow } from "@/lib/db/queries/transfers";

interface DealerSummary {
  id: string;
  name: string;
  shopName: string | null;
  note: string | null;
  basePercentOverride: number | null;
}

interface PerIdStat {
  id: string;
  phoneCount: number;
  thisMonthBase: number;
  lastActivity: string | null;
}

interface Props {
  dealers: DealerSummary[];
  models: ModelWithCurrentPrice[];
  stats: Record<string, PerIdStat>;
  transfers: InterIdRow[];
  stockByDealer: Record<string, string[]>;
  /** Owner viewing this dealer's portal in preview — unlocks provisioning
   *  additional Dealer IDs (dealers themselves are capped at one self-service ID). */
  isAdminPreview?: boolean;
}

export function DealerIdsClient({ dealers, models, stats, transfers, stockByDealer, isAdminPreview }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<DealerSummary | null>(null);
  const [transferEdit, setTransferEdit] = useState<InterIdRow | null>(null);

  const runTransferAction = (fn: () => Promise<{ error?: string }>, okMsg: string) => {
    startTransition(async () => {
      const res = await fn();
      if (res.error) { toast.error(res.error); return; }
      toast.success(okMsg);
      router.refresh();
    });
  };

  const handleAcceptTransfer = (t: InterIdRow) =>
    runTransferAction(() => acceptDealerTransferAction(t.id), "Transfer accepted — stock moved in");

  const handleRejectTransfer = (t: InterIdRow) => {
    if (!confirm(`Reject this transfer (${t.quantity} × ${t.modelName})? The stock stays with the source ID.`)) return;
    runTransferAction(() => rejectDealerTransferAction(t.id), "Transfer rejected");
  };

  const handleDeleteTransfer = (t: InterIdRow) => {
    const extra = t.status === "ACCEPTED"
      ? " This transfer was already accepted — the stock it added to the destination will be reversed."
      : "";
    if (!confirm(`Delete this transfer (${t.quantity} × ${t.modelName})?${extra} This cannot be undone.`)) return;
    runTransferAction(() => deleteDealerTransferAction(t.id), "Transfer deleted");
  };

  const [transferState, transferAction, transferring] = useActionState<DealerIdFormState, FormData>(
    createDealerInterIdTransferAction,
    {},
  );

  const [from, setFrom] = useState<string>(dealers[0]?.id ?? "");
  const [to, setTo] = useState<string>(dealers[1]?.id ?? "");
  const [modelId, setModelId] = useState<string>("");

  const availableModels = from
    ? models.filter((m) => stockByDealer[from]?.includes(m.id))
    : models;

  useEffect(() => {
    if (transferState.ok) {
      toast.success("Inter-ID transfer recorded");
      setModelId("");
      router.refresh();
    } else if (transferState.error) {
      toast.error(transferState.error);
    }
  }, [transferState, router]);

  const today = new Date().toISOString().slice(0, 10);
  const dealerName = (id: string) => dealers.find((d) => d.id === id)?.name ?? "—";
  const pendingCount = transfers.filter((t) => t.status === "PENDING").length;

  const statusBadge = (status: string) => {
    if (status === "ACCEPTED") return <Badge className="bg-green-500/15 text-green-700 border-green-200">Accepted</Badge>;
    if (status === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dealer IDs</h1>
        <p className="text-sm text-muted-foreground">
          Each ID has its own purchases, activations, and reports.
        </p>
      </div>

      {dealers.length === 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create your Dealer ID</CardTitle>
          </CardHeader>
          <CardContent>
            <AddDealerIdForm />
          </CardContent>
        </Card>
      ) : isAdminPreview ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add another Dealer ID (admin)</CardTitle>
            <p className="text-xs text-muted-foreground">
              You&apos;re viewing this dealer as owner — you can provision additional IDs here. Dealers can&apos;t self-add extra IDs.
            </p>
          </CardHeader>
          <CardContent>
            <AddDealerIdForm />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              <Lock className="size-4" />
              Additional Dealer IDs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Need a second Dealer ID? Additional IDs require admin approval and are subject to a separate subscription fee.
              Contact your OPPO account manager to request one.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Phones (lifetime)</TableHead>
                <TableHead className="text-right">4% this month</TableHead>
                <TableHead>Last activity</TableHead>
                {isAdminPreview ? <TableHead className="w-16 text-right">Edit</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dealers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdminPreview ? 5 : 4} className="py-8 text-center text-sm text-muted-foreground">
                    No Dealer IDs yet. Create one above.
                  </TableCell>
                </TableRow>
              ) : (
                dealers.map((d) => {
                  const s = stats[d.id];
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{d.name}</span>
                          {d.basePercentOverride != null ? (
                            <Badge variant="secondary" className="px-1 py-0 text-[10px] font-normal">
                              {d.basePercentOverride}% base
                            </Badge>
                          ) : null}
                        </div>
                        {d.shopName ? <div className="text-xs text-muted-foreground">{d.shopName}</div> : null}
                        {d.note ? <div className="text-xs text-muted-foreground">{d.note}</div> : null}
                      </TableCell>
                      <TableCell label="Phones (lifetime)" className="text-right tabular-nums">{s?.phoneCount ?? 0}</TableCell>
                      <TableCell label="4% this month" className="text-right tabular-nums">
                        {formatPKR(s?.thisMonthBase ?? 0)}
                      </TableCell>
                      <TableCell label="Last activity">{s?.lastActivity ? formatDate(s.lastActivity) : "—"}</TableCell>
                      {isAdminPreview ? (
                        <TableCell label="Edit" className="text-right">
                          <Button variant="ghost" size="icon" aria-label={`Edit ${d.name}`} onClick={() => setEditTarget(d)}>
                            <Pencil className="size-4" />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <ArrowRightCircle className="-mt-0.5 mr-1 inline size-4" />
            Inter-ID transfer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dealers.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              You need at least 2 Dealer IDs to transfer between them.
            </p>
          ) : (
            <form action={transferAction} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              <input type="hidden" name="fromDealerId" value={from} />
              <input type="hidden" name="toDealerId" value={to} />
              <input type="hidden" name="modelId" value={modelId} />

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs text-muted-foreground">From</label>
                <Select
                  value={from}
                  onValueChange={(v) => {
                    if (typeof v === "string") {
                      setFrom(v);
                      setModelId("");
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <span className={from ? "" : "text-muted-foreground"}>
                      {dealers.find((d) => d.id === from)?.name ?? "Source"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {dealers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs text-muted-foreground">To</label>
                <Select value={to} onValueChange={(v) => typeof v === "string" && setTo(v)}>
                  <SelectTrigger className="w-full">
                    <span className={to ? "" : "text-muted-foreground"}>
                      {dealers.find((d) => d.id === to)?.name ?? "Destination"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {dealers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Model</label>
                <Select value={modelId} onValueChange={(v) => typeof v === "string" && setModelId(v)}>
                  <SelectTrigger className="w-full">
                    <span className={modelId ? "" : "text-muted-foreground"}>
                      {availableModels.find((m) => m.id === modelId)?.name ??
                        (availableModels.length === 0 ? "No stock in source ID" : "Model")}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No stock in this ID</div>
                    ) : (
                      availableModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Input name="quantity" type="number" min={1} placeholder="Quantity" required />
              <Input name="transferDate" type="date" defaultValue={today} max={today} required />
              <Input name="note" placeholder="Note (optional)" />
              <Button type="submit" className="sm:col-span-3" disabled={transferring || !modelId}>
                {transferring ? "Transferring…" : "Record transfer"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {transfers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent inter-ID transfers</CardTitle>
            {pendingCount > 0 ? (
              <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                {pendingCount} transfer{pendingCount === 1 ? "" : "s"} waiting to be accepted — use Accept below to move the stock into the destination ID.
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.transferDate)}</TableCell>
                    <TableCell label="From">{dealerName(t.fromDealerId)}</TableCell>
                    <TableCell label="To">{dealerName(t.toDealerId)}</TableCell>
                    <TableCell label="Model">{t.modelName}</TableCell>
                    <TableCell label="Qty" className="text-right tabular-nums">{t.quantity}</TableCell>
                    <TableCell label="Status">{statusBadge(t.status)}</TableCell>
                    <TableCell label="Actions">
                      <div className="flex items-center justify-end gap-1">
                        {t.status === "PENDING" ? (
                          <>
                            <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => handleAcceptTransfer(t)}>
                              <Check className="size-3.5" /> Accept
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7" aria-label="Reject transfer" onClick={() => handleRejectTransfer(t)}>
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : null}
                        {t.status !== "REJECTED" ? (
                          <Button variant="ghost" size="icon" className="size-7" aria-label="Edit transfer" onClick={() => setTransferEdit(t)}>
                            <Pencil className="size-3.5" />
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon" className="size-7" aria-label="Delete transfer" onClick={() => handleDeleteTransfer(t)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {editTarget ? <EditDealerIdSheet dealer={editTarget} onClose={() => setEditTarget(null)} /> : null}
      {transferEdit ? (
        <EditTransferSheet
          transfer={transferEdit}
          onClose={() => setTransferEdit(null)}
          onSaved={() => { setTransferEdit(null); router.refresh(); }}
        />
      ) : null}
    </div>
  );
}

function EditTransferSheet({
  transfer, onClose, onSaved,
}: { transfer: InterIdRow; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState(String(transfer.quantity));
  const [date, setDate] = useState(transfer.transferDate);
  const [pending, start] = useTransition();

  const invalid = !(Number(qty) >= 1) || !/^\d{4}-\d{2}-\d{2}$/.test(date);

  const save = () => {
    start(async () => {
      const res = await editDealerTransferAction(transfer.id, { quantity: Number(qty), transferDate: date });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Transfer updated");
      onSaved();
    });
  };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader><SheetTitle>Edit transfer — {transfer.modelName}</SheetTitle></SheetHeader>
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted-foreground">
            {transfer.status === "ACCEPTED"
              ? "This transfer is already accepted — changing it also updates the stock it added to the destination ID (priced at the owner's central price for the new date)."
              : "Still pending — changing it only adjusts what leaves the source ID."}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Quantity</label>
              <Input type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <Button className="w-full" disabled={pending || invalid} onClick={save}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EditDealerIdSheet({ dealer, onClose }: { dealer: DealerSummary; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(dealer.name);
  const [shopName, setShopName] = useState(dealer.shopName ?? "");
  const [note, setNote] = useState(dealer.note ?? "");
  const [basePct, setBasePct] = useState(
    dealer.basePercentOverride == null ? "" : String(dealer.basePercentOverride),
  );
  const [pending, start] = useTransition();

  const save = () => {
    start(async () => {
      const fd = new FormData();
      fd.set("id", dealer.id);
      fd.set("name", name);
      fd.set("shopName", shopName);
      fd.set("note", note);
      fd.set("basePercentOverride", basePct);
      const res = await updateDealerTenantIdAction({}, fd);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Dealer ID updated");
      onClose();
      router.refresh();
    });
  };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader><SheetTitle>Edit Dealer ID</SheetTitle></SheetHeader>
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Shop name</label>
            <Input value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Note (optional)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Base incentive % for this ID</label>
            <Input
              type="number"
              step="any"
              min={0}
              max={100}
              value={basePct}
              onChange={(e) => setBasePct(e.target.value)}
              placeholder="Leave blank = use the global rate"
            />
            <p className="text-[10px] text-muted-foreground">
              Retail IDs normally use the global rate; set 3 on wholesale IDs. Changing this
              also re-computes past reports for this ID.
            </p>
          </div>
          <Button className="w-full" disabled={pending || !name.trim()} onClick={save}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

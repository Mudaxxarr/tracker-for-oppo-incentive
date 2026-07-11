"use client";

import { useActionState, useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  createCrossRegionAction,
  deleteDealerCrossRegionAction,
  editDealerCrossRegionAction,
  submitCrossRegionForApprovalAction,
  dealerCrOutwardAction,
  dealerDeleteCrOutwardAction,
  type CrossRegionFormState,
  type DealerOutwardState,
} from "./actions";
import { formatDate, formatPKR } from "@/lib/format";
import { CROSS_REGION_STATUS, type CrossRegionStatus } from "@/lib/constants";
import { CheckCircle2, Trash2, ArrowRightCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { CrossRegionRow } from "@/lib/db/queries/transfers";
import type { CrCaughtRow } from "@/lib/db/queries/cr-caught";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import { HelpTip } from "@/components/dealer/help-tip";

interface Props {
  models: ModelWithCurrentPrice[];
  initialTransfers: CrossRegionRow[];
  initialCrCaughtRows: CrCaughtRow[];
  hasDealer: boolean;
}

export function DealerCrossRegionClient({ models, initialTransfers, initialCrCaughtRows, hasDealer }: Props) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState<CrossRegionFormState, FormData>(createCrossRegionAction, {});
  const [editState, editAction, editPending] = useActionState<CrossRegionFormState, FormData>(editDealerCrossRegionAction, {});
  const [outwardState, outwardAction, outwardPending] = useActionState<DealerOutwardState, FormData>(dealerCrOutwardAction, {});
  const [, startTransition] = useTransition();
  const [editRow, setEditRow] = useState<CrossRegionRow | null>(null);
  const [modelId, setModelId] = useState("");
  const [outwardModelId, setOutwardModelId] = useState("");

  useEffect(() => {
    if (createState.ok) {
      toast.success("Cross-region transfer reported");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the field in response to a server-action result
      setModelId("");
      router.refresh();
    } else if (createState.error) {
      toast.error(createState.error);
    }
  }, [createState, router]);

  useEffect(() => {
    if (editState.ok) {
      toast.success("Transfer updated");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close the edit sheet in response to a server-action result
      setEditRow(null);
      router.refresh();
    } else if (editState.error) {
      toast.error(editState.error);
    }
  }, [editState, router]);

  useEffect(() => {
    if (outwardState.ok) {
      toast.success("Cross-region outward recorded — stock deducted from inventory");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the field in response to a server-action result
      setOutwardModelId("");
      router.refresh();
    } else if (outwardState.error) {
      toast.error(outwardState.error);
    }
  }, [outwardState, router]);

  const handleShiftToId = (id: string) => {
    if (!confirm("Add this cross-region stock into your inventory now?")) return;
    startTransition(async () => {
      const result = await submitCrossRegionForApprovalAction(id);
      if (result.ok) toast.success("Stock added to your inventory");
      else toast.error(result.message ?? "Could not add to inventory");
      router.refresh();
    });
  };

  const handleDeleteOutward = (id: string) => {
    if (!confirm("Undo this cross-region OUT? The stock will be restored to your inventory.")) return;
    startTransition(async () => {
      const res = await dealerDeleteCrOutwardAction(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Undone — stock restored");
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this cross-region row and any auto-created purchases? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteDealerCrossRegionAction(id);
        toast.success("Deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const today = new Date().toISOString().slice(0, 10);

  const activeModels = models.filter((m) => m.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold inline-flex items-center gap-1.5">
          Cross-Region <HelpTip term="cr-exposure" />
        </h1>
        <p className="text-sm text-muted-foreground">
          Stock coming INTO your ID from another region (inward), and stock caught leaving your ID (outward).
        </p>
      </div>

      {!hasDealer ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No active Dealer ID. Create one in <strong>IDs</strong> first.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="inward" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inward">Received (CR IN)</TabsTrigger>
            <TabsTrigger value="outward">Outward (CR OUT)</TabsTrigger>
          </TabsList>

          {/* ── INWARD (CR IN) ── */}
          <TabsContent value="inward" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Report new transfer</CardTitle></CardHeader>
              <CardContent>
                <form action={createAction} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <input type="hidden" name="modelId" value={modelId} />
                  <div className="sm:col-span-2">
                    <Select value={modelId} onValueChange={(v) => typeof v === "string" && setModelId(v)}>
                      <SelectTrigger className="w-full">
                        <span className={modelId ? "" : "text-muted-foreground"}>
                          {models.find((m) => m.id === modelId)?.name ?? "Choose model…"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {activeModels.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input name="quantity" type="number" min={1} placeholder="Quantity" required />
                  <Input name="reportedDate" type="date" defaultValue={today} required />
                  <Input name="sourceRegionNote" placeholder="Source region (note)" />
                  <Button type="submit" className="sm:col-span-5" disabled={createPending || !modelId}>
                    {createPending ? "Reporting…" : "Report transfer"}
                  </Button>
                </form>
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
                        <TableHead>Reported</TableHead>
                        <TableHead>Shifted</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[200px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {initialTransfers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No cross-region transfers reported.</TableCell>
                        </TableRow>
                      ) : initialTransfers.map((t) => {
                        const status = t.status as CrossRegionStatus;
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">{t.modelName}</TableCell>
                            <TableCell label="Qty" className="text-right tabular-nums">{t.quantity}</TableCell>
                            <TableCell label="Reported">{formatDate(t.reportedDate)}</TableCell>
                            <TableCell label="Shifted">{t.shiftedToIdDate ? formatDate(t.shiftedToIdDate) : "—"}</TableCell>
                            <TableCell label="Source" className="text-muted-foreground">{t.sourceRegionNote ?? "—"}</TableCell>
                            <TableCell label="Status">
                              {status === CROSS_REGION_STATUS.PENDING_REPORT ? (
                                <Badge variant="outline">Pending</Badge>
                              ) : status === CROSS_REGION_STATUS.PENDING_OWNER_APPROVAL ? (
                                <Badge variant="secondary">Awaiting Approval</Badge>
                              ) : status === CROSS_REGION_STATUS.SHIFTED_TO_MY_ID ? (
                                <Badge>Shifted</Badge>
                              ) : (
                                <Badge variant="destructive">Rejected</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {status === CROSS_REGION_STATUS.PENDING_REPORT || status === CROSS_REGION_STATUS.PENDING_OWNER_APPROVAL ? (
                                  <>
                                    {status === CROSS_REGION_STATUS.PENDING_REPORT ? (
                                      <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditRow(t)}><Pencil className="size-4" /></Button>
                                    ) : null}
                                    <Button size="icon-sm" variant="ghost" aria-label="Add to my inventory" title="Add to my inventory" onClick={() => handleShiftToId(t.id)}><ArrowRightCircle className="size-4" /></Button>
                                  </>
                                ) : status === CROSS_REGION_STATUS.SHIFTED_TO_MY_ID ? (
                                  <span className="text-xs text-muted-foreground"><CheckCircle2 className="mr-1 inline size-3.5" /> In inventory</span>
                                ) : null}
                                <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => handleDelete(t.id)}><Trash2 className="size-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── OUTWARD (CR OUT) ── */}
          <TabsContent value="outward" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Report outward (stock caught leaving your ID)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  Reports stock that left your ID cross-region. This deducts the stock from your inventory right away.
                </p>
                <form action={outwardAction} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <input type="hidden" name="modelId" value={outwardModelId} />
                  <div className="sm:col-span-2">
                    <Select value={outwardModelId} onValueChange={(v) => typeof v === "string" && setOutwardModelId(v)}>
                      <SelectTrigger className="w-full">
                        <span className={outwardModelId ? "" : "text-muted-foreground"}>
                          {models.find((m) => m.id === outwardModelId)?.name ?? "Choose model…"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {activeModels.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input name="quantity" type="number" min={1} placeholder="Qty caught" required />
                  <Input name="caughtDate" type="date" defaultValue={today} required />
                  <Input name="fineAmount" type="number" min={0} step="any" placeholder="Fine ₨ (optional)" />
                  <Input name="note" placeholder="Note (optional)" className="sm:col-span-4" />
                  <Button type="submit" className="sm:col-span-5" disabled={outwardPending || !outwardModelId}>
                    {outwardPending ? "Reporting…" : "Report outward"}
                  </Button>
                </form>
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
                        <TableHead className="text-right">Fine ₨</TableHead>
                        <TableHead>Caught</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {initialCrCaughtRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No outward (caught) entries.</TableCell>
                        </TableRow>
                      ) : initialCrCaughtRows.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.modelName}</TableCell>
                          <TableCell label="Qty" className="text-right tabular-nums">{c.quantity}</TableCell>
                          <TableCell label="Fine ₨" className="text-right tabular-nums">{c.fineAmount ? formatPKR(c.fineAmount) : "—"}</TableCell>
                          <TableCell label="Caught">{formatDate(c.caughtDate)}</TableCell>
                          <TableCell label="Note" className="text-muted-foreground">{c.note ?? "—"}</TableCell>
                          <TableCell label="Status">
                            {c.status === "pending_owner_approval" ? (
                              <Badge variant="secondary">Awaiting Approval</Badge>
                            ) : c.status === "rejected" ? (
                              <Badge variant="destructive">Rejected</Badge>
                            ) : (
                              <Badge>Deducted</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {c.status !== "rejected" ? (
                              <Button size="icon-sm" variant="ghost" aria-label="Undo (restore stock)" title="Undo — restore stock" onClick={() => handleDeleteOutward(c.id)}>
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Sheet open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Transfer — {editRow?.modelName}</SheetTitle>
          </SheetHeader>
          {editRow ? (
            <div className="p-4">
              <form action={editAction} className="space-y-4">
                <input type="hidden" name="id" value={editRow.id} />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Quantity</label>
                  <Input name="quantity" type="number" min={1} defaultValue={editRow.quantity} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Reported date</label>
                  <Input name="reportedDate" type="date" defaultValue={editRow.reportedDate} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Source region note</label>
                  <Input name="sourceRegionNote" defaultValue={editRow.sourceRegionNote ?? ""} placeholder="e.g. Lahore" />
                </div>
                <Button type="submit" className="w-full" disabled={editPending}>
                  {editPending ? "Saving…" : "Save Changes"}
                </Button>
              </form>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

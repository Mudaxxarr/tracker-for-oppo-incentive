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
  deleteCrossRegionAction,
  editCrossRegionAction,
  updateStatusAction,
  crOutwardAction,
  deleteCrCaughtAction,
  approveCrCaughtAction,
  type CrFormState,
  type OutwardState,
} from "./actions";
import { formatDate, formatPKR } from "@/lib/format";
import { CROSS_REGION_STATUS, type CrossRegionStatus } from "@/lib/constants";
import { CheckCircle2, XCircle, Trash2, ArrowRightCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { CrossRegionRow } from "@/lib/db/queries/transfers";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { StaffRole } from "@/lib/constants";

// Defined locally — mirrors CrCaughtRow from cr-caught.ts (server-only)
interface CrCaughtRow {
  id: string;
  modelId: string;
  modelName: string;
  quantity: number;
  fineAmount: number | null;
  caughtDate: string;
  dealerPriceSnapshot: number;
  note: string | null;
  status: string;
}

interface Props {
  models: ModelWithCurrentPrice[];
  initial: CrossRegionRow[];
  hasDealer: boolean;
  staffRole?: StaffRole | null;
  initialCrCaughtRows: CrCaughtRow[];
}

const STATUS_LABEL: Record<CrossRegionStatus, string> = {
  PENDING_REPORT: "Pending",
  PENDING_OWNER_APPROVAL: "Awaiting Approval",
  SHIFTED_TO_MY_ID: "Shifted to My ID",
  REJECTED: "Rejected",
};

export function CrossRegionClient({ models, initial, hasDealer, staffRole, initialCrCaughtRows }: Props) {
  const isSO = staffRole === "so";
  const router = useRouter();
  const [, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  // ── CR IN state ──────────────────────────────────────────────────────────────
  const [createState, createAction, createPending] = useActionState<CrFormState, FormData>(createCrossRegionAction, {});
  const [editState, editAction, editPending] = useActionState<CrFormState, FormData>(editCrossRegionAction, {});
  const [editRow, setEditRow] = useState<CrossRegionRow | null>(null);
  const [modelId, setModelId] = useState("");

  useEffect(() => {
    if (createState.ok) {
      toast.success("Cross-region transfer reported");
      setModelId("");
      router.refresh();
    } else if (createState.error) toast.error(createState.error);
  }, [createState, router]);

  useEffect(() => {
    if (editState.ok) {
      toast.success("Transfer updated");
      setEditRow(null);
      router.refresh();
    } else if (editState.error) toast.error(editState.error);
  }, [editState]);

  const handleStatus = (id: string, status: CrossRegionStatus) => {
    if (
      status === CROSS_REGION_STATUS.SHIFTED_TO_MY_ID &&
      !confirm("Mark as shifted? This auto-creates linked purchase rows at the current dealer price.")
    ) return;
    startTransition(async () => {
      const result = await updateStatusAction(id, status);
      if (result.ok) toast.success(`Status: ${STATUS_LABEL[status]}`);
      else toast.error(result.message ?? "Update failed");
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this cross-region row and any auto-created purchases? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteCrossRegionAction(id);
        toast.success("Deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  // ── CR OUT state ─────────────────────────────────────────────────────────────
  const [outwardState, outwardAction, outwardPending] = useActionState<OutwardState, FormData>(crOutwardAction, {});
  const [outModelId, setOutModelId] = useState("");

  useEffect(() => {
    if (outwardState.ok) {
      toast.success(outwardState.pendingApproval ? "Submitted — awaiting owner approval" : "Penalty logged");
      setOutModelId("");
      router.refresh();
    } else if (outwardState.error) toast.error(outwardState.error);
  }, [outwardState, router]);

  const handleApproveCaught = (id: string) => {
    startTransition(async () => {
      const result = await approveCrCaughtAction(id);
      if (result.ok) { toast.success("Approved — stock deducted"); router.refresh(); }
      else toast.error(result.error ?? "Approve failed");
    });
  };

  const handleDeleteCaught = (id: string) => {
    if (!confirm("Delete this penalty entry? Stock will be restored.")) return;
    startTransition(async () => {
      const result = await deleteCrCaughtAction(id);
      if (result.ok) { toast.success("Deleted — stock restored"); router.refresh(); }
      else toast.error(result.error ?? "Delete failed");
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cross-Region</h1>
        <p className="text-sm text-muted-foreground">
          {isSO
            ? "Submit cross-region requests or log penalties for owner review."
            : "Manage inward stock transfers and outward penalty records."}
        </p>
      </div>

      <Tabs defaultValue="inward" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inward">Received (CR IN)</TabsTrigger>
          <TabsTrigger value="outward">Penalties (CR OUT)</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: CR IN ──────────────────────────────────────────────────── */}
        <TabsContent value="inward" className="space-y-4">
          {!hasDealer ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Create a Dealer ID first.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Report new transfer</CardTitle>
              </CardHeader>
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
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
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
          )}

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
                    {initial.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          No cross-region transfers reported.
                        </TableCell>
                      </TableRow>
                    ) : initial.map((t) => {
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
                              {isSO ? (
                                status === CROSS_REGION_STATUS.PENDING_OWNER_APPROVAL ? (
                                  <span className="text-xs text-muted-foreground">Awaiting owner approval</span>
                                ) : status === CROSS_REGION_STATUS.SHIFTED_TO_MY_ID ? (
                                  <span className="text-xs text-muted-foreground">
                                    <CheckCircle2 className="mr-1 inline size-3.5" /> Approved
                                  </span>
                                ) : status === CROSS_REGION_STATUS.REJECTED ? (
                                  <span className="text-xs text-destructive">Rejected</span>
                                ) : null
                              ) : (
                                <>
                                  {status === CROSS_REGION_STATUS.PENDING_REPORT ? (
                                    <>
                                      <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditRow(t)}>
                                        <Pencil className="size-4" />
                                      </Button>
                                      <Button size="icon-sm" variant="ghost" aria-label="Mark shifted" onClick={() => handleStatus(t.id, CROSS_REGION_STATUS.SHIFTED_TO_MY_ID)}>
                                        <ArrowRightCircle className="size-4" />
                                      </Button>
                                      <Button size="icon-sm" variant="ghost" aria-label="Mark rejected" onClick={() => handleStatus(t.id, CROSS_REGION_STATUS.REJECTED)}>
                                        <XCircle className="size-4" />
                                      </Button>
                                    </>
                                  ) : status === CROSS_REGION_STATUS.PENDING_OWNER_APPROVAL ? (
                                    <>
                                      <Button size="icon-sm" variant="ghost" aria-label="Approve — shift stock to dealer ID" onClick={() => handleStatus(t.id, CROSS_REGION_STATUS.SHIFTED_TO_MY_ID)}>
                                        <CheckCircle2 className="size-4 text-green-600" />
                                      </Button>
                                      <Button size="icon-sm" variant="ghost" aria-label="Reject" onClick={() => handleStatus(t.id, CROSS_REGION_STATUS.REJECTED)}>
                                        <XCircle className="size-4 text-destructive" />
                                      </Button>
                                    </>
                                  ) : status === CROSS_REGION_STATUS.SHIFTED_TO_MY_ID ? (
                                    <span className="text-xs text-muted-foreground">
                                      <CheckCircle2 className="mr-1 inline size-3.5" /> Done
                                    </span>
                                  ) : null}
                                  <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => handleDelete(t.id)}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                </>
                              )}
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

        {/* ── TAB 2: CR OUT ─────────────────────────────────────────────────── */}
        <TabsContent value="outward" className="space-y-4">
          {!hasDealer ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Create a Dealer ID first.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isSO ? "Log CR-caught units (pending approval)" : "Log CR-caught units / cash fine"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={outwardAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input type="hidden" name="modelId" value={outModelId} />
                  <div className="sm:col-span-2">
                    <Select value={outModelId} onValueChange={(v) => typeof v === "string" && setOutModelId(v)}>
                      <SelectTrigger className="w-full">
                        <span className={outModelId ? "" : "text-muted-foreground"}>
                          {models.find((m) => m.id === outModelId)?.name ?? "Choose model…"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input name="quantity" type="number" min={0} defaultValue={0} placeholder="Units caught (0 = fine only)" required />
                  <Input name="caughtDate" type="date" defaultValue={today} required />
                  <Input
                    name="fineAmount"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Fine amount PKR (optional)"
                    className="font-mono text-destructive placeholder:text-muted-foreground/50"
                  />
                  <Input name="note" placeholder="Note (optional)" className="sm:col-span-2" />
                  <Button
                    type="submit"
                    variant="destructive"
                    className="sm:col-span-4"
                    disabled={outwardPending || !outModelId}
                  >
                    {outwardPending ? "Logging…" : isSO ? "Submit for Approval" : "Log Penalty"}
                  </Button>
                </form>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Qty &gt; 0 deducts stock and records the unit loss. Qty = 0 logs a cash-only fine (owner only).
                  {isSO && " SO submissions require owner approval before stock is deducted."}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Price Snap</TableHead>
                      <TableHead className="text-right">Fine</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Status</TableHead>
                      {!isSO && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialCrCaughtRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isSO ? 7 : 8} className="py-10 text-center text-sm text-muted-foreground">
                          No penalty records yet.
                        </TableCell>
                      </TableRow>
                    ) : initialCrCaughtRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.modelName}</TableCell>
                        <TableCell label="Qty" className="text-right tabular-nums">{r.quantity}</TableCell>
                        <TableCell label="Date">{formatDate(r.caughtDate)}</TableCell>
                        <TableCell label="Price Snap" className="text-right tabular-nums font-mono text-xs">
                          {r.quantity > 0 ? formatPKR(r.dealerPriceSnapshot) : "—"}
                        </TableCell>
                        <TableCell label="Fine" className="text-right tabular-nums font-mono text-xs text-destructive">
                          {(r.fineAmount ?? 0) > 0 ? formatPKR(r.fineAmount ?? 0) : "—"}
                        </TableCell>
                        <TableCell label="Note" className="text-muted-foreground text-xs">{r.note ?? "—"}</TableCell>
                        <TableCell label="Status">
                          {r.status === "pending_owner_approval" ? (
                            <Badge variant="secondary">Pending</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                        {!isSO && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {r.status === "pending_owner_approval" && (
                                <Button size="icon-sm" variant="ghost" aria-label="Approve" onClick={() => handleApproveCaught(r.id)}>
                                  <CheckCircle2 className="size-4 text-green-600" />
                                </Button>
                              )}
                              <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => handleDeleteCaught(r.id)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Sheet — only for PENDING CR IN rows */}
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

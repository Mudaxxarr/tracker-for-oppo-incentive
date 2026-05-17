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
import { Badge } from "@/components/ui/badge";
import {
  createCrossRegionAction,
  deleteCrossRegionAction,
  editCrossRegionAction,
  updateStatusAction,
  type CrFormState,
} from "./actions";
import { formatDate } from "@/lib/format";
import { CROSS_REGION_STATUS, type CrossRegionStatus } from "@/lib/constants";
import { CheckCircle2, XCircle, Trash2, ArrowRightCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { CrossRegionRow } from "@/lib/db/queries/transfers";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";

interface Props {
  models: ModelWithCurrentPrice[];
  initial: CrossRegionRow[];
  hasDealer: boolean;
}

const STATUS_LABEL: Record<CrossRegionStatus, string> = {
  PENDING_REPORT: "Pending",
  SHIFTED_TO_MY_ID: "Shifted to My ID",
  REJECTED: "Rejected",
};

export function CrossRegionClient({ models, initial, hasDealer }: Props) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState<CrFormState, FormData>(
    createCrossRegionAction,
    {}
  );
  const [editState, editAction, editPending] = useActionState<CrFormState, FormData>(
    editCrossRegionAction,
    {}
  );
  const [, startTransition] = useTransition();
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
      await deleteCrossRegionAction(id);
      toast.success("Deleted");
    });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cross-Region transfers</h1>
        <p className="text-sm text-muted-foreground">
          Report stock that OPPO has sent (or is about to send) into your dealer ID from another region.
        </p>
      </div>

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
                      <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                      <TableCell>{formatDate(t.reportedDate)}</TableCell>
                      <TableCell>{t.shiftedToIdDate ? formatDate(t.shiftedToIdDate) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{t.sourceRegionNote ?? "—"}</TableCell>
                      <TableCell>
                        {status === CROSS_REGION_STATUS.PENDING_REPORT ? (
                          <Badge variant="outline">Pending</Badge>
                        ) : status === CROSS_REGION_STATUS.SHIFTED_TO_MY_ID ? (
                          <Badge>Shifted</Badge>
                        ) : (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {status === CROSS_REGION_STATUS.PENDING_REPORT ? (
                            <>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Edit"
                                onClick={() => setEditRow(t)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Mark shifted"
                                onClick={() => handleStatus(t.id, CROSS_REGION_STATUS.SHIFTED_TO_MY_ID)}
                              >
                                <ArrowRightCircle className="size-4" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Mark rejected"
                                onClick={() => handleStatus(t.id, CROSS_REGION_STATUS.REJECTED)}
                              >
                                <XCircle className="size-4" />
                              </Button>
                            </>
                          ) : status === CROSS_REGION_STATUS.SHIFTED_TO_MY_ID ? (
                            <span className="text-xs text-muted-foreground">
                              <CheckCircle2 className="mr-1 inline size-3.5" /> Done
                            </span>
                          ) : null}
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Delete"
                            onClick={() => handleDelete(t.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
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

      {/* Edit Sheet — only for PENDING rows */}
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
                  <Input
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={editRow.quantity}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Reported date</label>
                  <Input
                    name="reportedDate"
                    type="date"
                    defaultValue={editRow.reportedDate}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Source region note</label>
                  <Input
                    name="sourceRegionNote"
                    defaultValue={editRow.sourceRegionNote ?? ""}
                    placeholder="e.g. Lahore"
                  />
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

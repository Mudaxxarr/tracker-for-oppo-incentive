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
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createDealerIdAction,
  createInterIdTransferAction,
  deleteDealerIdAction,
  type IdFormState,
} from "./actions";
import { formatDate, formatPKR } from "@/lib/format";
import { Trash2, Plus, ArrowRightCircle } from "lucide-react";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import type { InterIdRow } from "@/lib/db/queries/transfers";

interface DealerSummary {
  id: string;
  name: string;
  note: string | null;
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
}

export function IdsClient({ dealers, models, stats, transfers, stockByDealer }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [createState, createAction, creating] = useActionState<IdFormState, FormData>(
    createDealerIdAction,
    {}
  );
  const [transferState, transferAction, transferring] = useActionState<IdFormState, FormData>(
    createInterIdTransferAction,
    {}
  );

  const [from, setFrom] = useState<string>(dealers[0]?.id ?? "");
  const [to, setTo] = useState<string>(dealers[1]?.id ?? "");
  const [modelId, setModelId] = useState<string>("");

  // Only show models that the source dealer actually has in stock
  const availableModels = from
    ? models.filter((m) => stockByDealer[from]?.includes(m.id))
    : models;

  useEffect(() => {
    if (createState.ok) {
      toast.success("Dealer ID created and switched to it");
      router.refresh();
    } else if (createState.error) {
      toast.error(createState.error);
    }
  }, [createState, router]);

  useEffect(() => {
    if (transferState.ok) {
      toast.success("Inter-ID transfer recorded");
      setModelId("");
      router.refresh();
    } else if (transferState.error) {
      toast.error(transferState.error);
    }
  }, [transferState, router]);

  const handleDelete = (id: string, name: string) => {
    if (
      !confirm(
        `Delete "${name}" and all its purchases, activations, and policies? This cannot be undone.`
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteDealerIdAction(id);
      if (!result.ok) toast.error(result.error ?? "Delete failed");
      else {
        toast.success("Dealer ID deleted");
        router.refresh();
      }
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const dealerName = (id: string) => dealers.find((d) => d.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dealer IDs</h1>
        <p className="text-sm text-muted-foreground">
          Each ID has its own purchases, activations, policies, and reports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <Plus className="-mt-0.5 mr-1 inline size-4" />
            Create Dealer ID
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input name="name" placeholder="e.g., Khanewal Branch 2" required />
            <Input name="note" placeholder="Note (optional)" />
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Phones (lifetime)</TableHead>
                <TableHead className="text-right">4% this month</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dealers.map((d) => {
                const s = stats[d.id];
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.name}</div>
                      {d.note ? <div className="text-xs text-muted-foreground">{d.note}</div> : null}
                    </TableCell>
                    <TableCell label="Phones (lifetime)" className="text-right tabular-nums">{s?.phoneCount ?? 0}</TableCell>
                    <TableCell label="4% this month" className="text-right tabular-nums">
                      {formatPKR(s?.thisMonthBase ?? 0)}
                    </TableCell>
                    <TableCell label="Last activity">{s?.lastActivity ? formatDate(s.lastActivity) : "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete"
                        onClick={() => handleDelete(d.id, d.name)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
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
                <Select value={from} onValueChange={(v) => { if (typeof v === "string") { setFrom(v); setModelId(""); } }}>
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
                      {availableModels.find((m) => m.id === modelId)?.name ?? (availableModels.length === 0 ? "No stock in source ID" : "Model")}
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
              <Input name="transferDate" type="date" defaultValue={today} required />
              <Input name="note" placeholder="Note (optional)" />
              <Button type="submit" className="sm:col-span-3" disabled={transferring}>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

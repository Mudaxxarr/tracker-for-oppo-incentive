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
  type DealerIdFormState,
} from "./actions";
import { formatDate, formatPKR } from "@/lib/format";
import { Lock, ArrowRightCircle } from "lucide-react";
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

export function DealerIdsClient({ dealers, models, stats, transfers, stockByDealer }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Phones (lifetime)</TableHead>
                <TableHead className="text-right">4% this month</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dealers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No Dealer IDs yet. Create one above.
                  </TableCell>
                </TableRow>
              ) : (
                dealers.map((d) => {
                  const s = stats[d.id];
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="font-medium">{d.name}</div>
                        {d.note ? <div className="text-xs text-muted-foreground">{d.note}</div> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s?.phoneCount ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPKR(s?.thisMonthBase ?? 0)}
                      </TableCell>
                      <TableCell>{s?.lastActivity ? formatDate(s.lastActivity) : "—"}</TableCell>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.transferDate)}</TableCell>
                    <TableCell>{dealerName(t.fromDealerId)}</TableCell>
                    <TableCell>{dealerName(t.toDealerId)}</TableCell>
                    <TableCell>{t.modelName}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
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

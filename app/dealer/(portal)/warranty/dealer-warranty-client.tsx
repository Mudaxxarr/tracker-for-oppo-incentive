"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createDealerWarrantyClaimAction,
  updateDealerWarrantyStatusAction,
  type WarrantyFormState,
} from "./actions";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { WarrantyClaimRow } from "@/lib/db/queries/warranty-claims";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import { ShieldCheck, Plus } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_repair: "In Repair",
  resolved: "Resolved",
  rejected: "Rejected",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  in_repair: "default",
  resolved: "outline",
  rejected: "destructive",
};

const NEXT_STATUSES: Record<string, { value: string; label: string }[]> = {
  pending: [
    { value: "in_repair", label: "Mark In Repair" },
    { value: "resolved", label: "Resolve" },
    { value: "rejected", label: "Reject" },
  ],
  in_repair: [
    { value: "resolved", label: "Resolve" },
    { value: "rejected", label: "Reject" },
  ],
  resolved: [],
  rejected: [],
};

interface Props {
  initialClaims: WarrantyClaimRow[];
  models: ModelWithCurrentPrice[];
}

export function DealerWarrantyClient({ initialClaims, models }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [, startTransition] = useTransition();
  const [updating, setUpdating] = useState<string | null>(null);
  const [state, action, pending] = useActionState<WarrantyFormState, FormData>(
    createDealerWarrantyClaimAction,
    {}
  );

  if (state.ok && !pending) {
    toast.success("Warranty claim logged");
    startTransition(() => router.refresh());
  }
  if (state.error && !pending) {
    toast.error(state.error);
  }

  const filtered = filter === "all" ? initialClaims : initialClaims.filter((c) => c.status === filter);

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdating(id);
    const res = await updateDealerWarrantyStatusAction(id, status);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Status updated");
      startTransition(() => router.refresh());
    }
    setUpdating(null);
  };

  const activeModels = models.filter((m) => m.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Warranty Claims</h1>
        <p className="text-sm text-muted-foreground">Log and track customer warranty issues.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" />
            Log new claim
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Model *</label>
                <Select name="modelId" required>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select model…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Customer (optional)</label>
                <Input name="customerId" placeholder="Customer ID (optional)" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Issue description *</label>
              <textarea
                name="issueDesc"
                placeholder="Describe the problem the customer is experiencing…"
                required
                minLength={5}
                maxLength={500}
                rows={3}
                className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Log claim"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <span className="font-medium text-sm">Claims</span>
            <div className="ml-auto flex gap-2 flex-wrap">
              {["all", "pending", "in_repair", "resolved", "rejected"].map((s) => (
                <Button
                  key={s}
                  variant={filter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(s)}
                >
                  {s === "all" ? "All" : STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      {filter === "all" ? "No warranty claims yet." : `No ${STATUS_LABEL[filter]?.toLowerCase()} claims.`}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.modelName}</TableCell>
                      <TableCell className="text-muted-foreground">{c.customerName ?? "—"}</TableCell>
                      <TableCell className="max-w-xs">
                        <span className="line-clamp-2 text-sm">{c.issueDesc}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(c.createdAt.slice(0, 10))}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(NEXT_STATUSES[c.status] ?? []).map((ns) => (
                            <Button
                              key={ns.value}
                              variant="outline"
                              size="sm"
                              disabled={updating === c.id}
                              onClick={() => handleStatusUpdate(c.id, ns.value)}
                            >
                              {ns.label}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

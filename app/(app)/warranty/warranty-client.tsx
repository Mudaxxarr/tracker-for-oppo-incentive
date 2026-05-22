"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateWarrantyStatusAction } from "./actions";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { WarrantyClaimRow } from "@/lib/db/queries/warranty-claims";
import { ShieldCheck, Search } from "lucide-react";

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
    { value: "in_repair", label: "In Repair" },
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
}

export function WarrantyClient({ initialClaims }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdating(id);
    const res = await updateWarrantyStatusAction(id, status);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Status updated");
      startTransition(() => router.refresh());
    }
    setUpdating(null);
  };

  const filtered = initialClaims
    .filter((c) => filter === "all" || c.status === filter)
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.modelName.toLowerCase().includes(q) ||
        c.dealerName.toLowerCase().includes(q) ||
        (c.customerName ?? "").toLowerCase().includes(q) ||
        c.issueDesc.toLowerCase().includes(q)
      );
    });

  const counts = initialClaims.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Warranty Claims</h1>
        <p className="text-sm text-muted-foreground">All warranty claims across all dealers.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(STATUS_LABEL).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? "all" : key)}
            className={`rounded-lg border p-3 text-left transition-colors ${filter === key ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"}`}
          >
            <div className="text-2xl font-bold">{counts[key] ?? 0}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              placeholder="Search model, dealer, customer, issue…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <div className="ml-auto flex gap-2 flex-wrap">
              {["all", ...Object.keys(STATUS_LABEL)].map((s) => (
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
                  <TableHead>Dealer</TableHead>
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
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No warranty claims found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium whitespace-nowrap">{c.dealerName}</TableCell>
                      <TableCell className="whitespace-nowrap">{c.modelName}</TableCell>
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

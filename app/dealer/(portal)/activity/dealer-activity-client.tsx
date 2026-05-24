"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import type { AuditLog } from "@/lib/db/schema";
import { CheckCircle2, AlertOctagon, ChevronDown, ChevronRight } from "lucide-react";

interface Filters {
  action?: string;
  search?: string;
  from?: string;
  to?: string;
}

interface Props {
  rows: AuditLog[];
  initialFilters: Filters;
  hasDealer: boolean;
}

const ACTION_GROUPS = [
  { value: "all", label: "All actions" },
  { value: "auth", label: "Authentication" },
  { value: "purchase", label: "Purchases" },
  { value: "activation", label: "Activations" },
  { value: "cross_region", label: "Cross-Region" },
  { value: "inter_id", label: "Inter-ID transfers" },
  { value: "model", label: "Models" },
];

export function DealerActivityClient({ rows, initialFilters, hasDealer }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const update = <K extends keyof Filters>(key: K, value: Filters[K] | undefined) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    router.replace(`/dealer/activity${sp.size ? `?${sp}` : ""}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity log</h1>
        <p className="text-sm text-muted-foreground">
          Every change is recorded here — useful for forensic investigation if there&apos;s ever a dispute.
        </p>
      </div>

      {!hasDealer ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No active Dealer ID — create one in IDs first.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Select
                  value={filters.action ?? "all"}
                  onValueChange={(v) =>
                    update("action", typeof v === "string" && v !== "all" ? v : undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_GROUPS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Search summary…"
                  value={filters.search ?? ""}
                  onChange={(e) => update("search", e.target.value || undefined)}
                />
                <Input
                  type="date"
                  value={filters.from ?? ""}
                  onChange={(e) => update("from", e.target.value || undefined)}
                />
                <Input
                  type="date"
                  value={filters.to ?? ""}
                  onChange={(e) => update("to", e.target.value || undefined)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">When</TableHead>
                    <TableHead className="w-[200px]">Action</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                        No activity matches the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => {
                      let when = "—";
                      try {
                        when = format(parseISO(r.createdAt), "dd MMM yyyy HH:mm:ss");
                      } catch {
                        when = r.createdAt;
                      }
                      const isErr = r.status === "error";
                      const isOpen = !!expanded[r.id];
                      return (
                        <Fragment key={r.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() =>
                              setExpanded((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                            }
                          >
                            <TableCell className="text-xs tabular-nums">
                              <span className="inline-flex items-center gap-1">
                                {isOpen ? (
                                  <ChevronDown className="size-3" />
                                ) : (
                                  <ChevronRight className="size-3" />
                                )}
                                {when}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={isErr ? "destructive" : "outline"} className="font-mono text-[10px]">
                                {isErr ? <AlertOctagon className="mr-1 size-3" /> : <CheckCircle2 className="mr-1 size-3" />}
                                {r.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{r.summary}</TableCell>
                          </TableRow>
                          {isOpen ? (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={3} className="text-xs">
                                <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                  <div>
                                    <dt className="text-muted-foreground">ID</dt>
                                    <dd className="font-mono">{r.id}</dd>
                                  </div>
                                  {r.entityType && (
                                    <div>
                                      <dt className="text-muted-foreground">Entity</dt>
                                      <dd>{r.entityType} {r.entityId?.slice(0, 8) ?? ""}</dd>
                                    </div>
                                  )}
                                  {r.payload ? (
                                    <div className="sm:col-span-2">
                                      <dt className="text-muted-foreground">Payload</dt>
                                      <dd className="overflow-x-auto rounded bg-background p-2 font-mono text-[11px] leading-snug">
                                        {prettyJson(r.payload)}
                                      </dd>
                                    </div>
                                  ) : null}
                                </dl>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Showing the most recent {rows.length} entries.
          </p>
        </>
      )}
    </div>
  );
}

function prettyJson(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

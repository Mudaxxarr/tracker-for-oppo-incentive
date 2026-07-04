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

interface DealerOpt {
  id: string;
  name: string;
}

interface Filters {
  dealerId?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
}

interface Props {
  dealers: DealerOpt[];
  rows: AuditLog[];
  initialFilters: Filters;
}

const ACTION_GROUPS = [
  { value: "all", label: "All actions" },
  { value: "auth", label: "Authentication" },
  { value: "dealer", label: "Dealer IDs" },
  { value: "purchase", label: "Purchases" },
  { value: "activation", label: "Activations" },
  { value: "policy", label: "Policies" },
  { value: "cross_region", label: "Cross-Region" },
  { value: "inter_id", label: "Inter-ID transfers" },
  { value: "model", label: "Model prices" },
  { value: "settings", label: "Settings" },
  { value: "report", label: "Reports / exports" },
];

export function ActivityClient({ dealers, rows, initialFilters }: Props) {
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
    router.replace(`/activity${sp.size ? `?${sp}` : ""}`);
  };

  const dealerName = (id: string | null) =>
    id ? dealers.find((d) => d.id === id)?.name ?? id.slice(0, 8) : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity log</h1>
        <p className="text-sm text-muted-foreground">
          Every change is recorded here — useful for forensic investigation if OPPO ever disputes a number.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <Select
              value={filters.dealerId ?? "all"}
              onValueChange={(v) =>
                update("dealerId", typeof v === "string" && v !== "all" ? v : undefined)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All dealer IDs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dealer IDs</SelectItem>
                {dealers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">From date</span>
              <Input
                type="date"
                value={filters.from ?? ""}
                onChange={(e) => update("from", e.target.value || undefined)}
                aria-label="From date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">To date</span>
              <Input
                type="date"
                value={filters.to ?? ""}
                onChange={(e) => update("to", e.target.value || undefined)}
                aria-label="To date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">When</TableHead>
                <TableHead className="w-[140px]">Dealer ID</TableHead>
                <TableHead className="w-[180px]">Action</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
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
                        <TableCell className="text-xs">{dealerName(r.dealerId)}</TableCell>
                        <TableCell>
                          <Badge variant={isErr ? "destructive" : "outline"} className="font-mono text-[10px]">
                            {isErr ? <AlertOctagon className="mr-1 size-3" /> : <CheckCircle2 className="mr-1 size-3" />}
                            {r.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{r.summary}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {isOpen ? (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={5} className="text-xs">
                            <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                              <Detail k="ID" v={r.id} mono />
                              <Detail k="Entity" v={r.entityType ? `${r.entityType} ${r.entityId?.slice(0, 8) ?? ""}` : "—"} />
                              <Detail k="IP" v={r.ipAddress ?? "—"} />
                              <Detail
                                k="User-Agent"
                                v={r.userAgent ? r.userAgent.slice(0, 80) : "—"}
                              />
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
    </div>
  );
}

function Detail({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={mono ? "font-mono" : ""}>{v}</dd>
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

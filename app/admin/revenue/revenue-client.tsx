"use client";

import { useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setDealerMonthlyFeeAction } from "./actions";
import { formatDate, formatPKR } from "@/lib/format";
import { toast } from "sonner";
import type { RevenueTenantRow } from "@/lib/admin/dealers";
import {
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Check,
} from "lucide-react";

interface Stats {
  totalActive: number;
  totalGrace: number;
  totalExpired: number;
  totalSuspended: number;
  expiringIn7: number;
  expiringIn30: number;
  mrr: number;
  arr: number;
}

interface Props {
  tenants: RevenueTenantRow[];
  stats: Stats;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  grace: "secondary",
  expired: "destructive",
  suspended: "outline",
};

function FeeEditor({ tenant }: { tenant: RevenueTenantRow }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(tenant.monthlyFee?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await setDealerMonthlyFeeAction(tenant.id, value);
    setSaving(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Fee updated");
      startTransition(() => router.refresh());
    }
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">PKR</span>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="—"
        className="w-24 h-7 text-sm px-2"
      />
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={save} disabled={saving}>
        <Check className="size-3" />
      </Button>
    </div>
  );
}

export function RevenueClient({ tenants, stats }: Props) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? tenants : tenants.filter((t) => t.status === filter);
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Revenue Dashboard</h1>
        <p className="text-sm text-muted-foreground">Subscription overview and MRR tracking.</p>
      </div>

      {/* MRR / ARR */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="size-4" />
              MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPKR(stats.mrr)}</div>
            <div className="text-xs text-muted-foreground mt-1">Monthly Recurring Revenue</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ARR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPKR(stats.arr)}</div>
            <div className="text-xs text-muted-foreground mt-1">Annual Recurring Revenue</div>
          </CardContent>
        </Card>
        <Card className={stats.expiringIn7 > 0 ? "border-amber-300 bg-amber-50/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="size-4 text-amber-500" />
              Expiring in 7 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.expiringIn7 > 0 ? "text-amber-600" : ""}`}>
              {stats.expiringIn7}
            </div>
          </CardContent>
        </Card>
        <Card className={stats.expiringIn30 > 0 ? "border-yellow-200 bg-yellow-50/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expiring in 30 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiringIn30}</div>
          </CardContent>
        </Card>
      </div>

      {/* Status counts */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { key: "active", label: "Active", count: stats.totalActive, Icon: CheckCircle2, color: "text-green-600" },
          { key: "grace", label: "Grace", count: stats.totalGrace, Icon: AlertTriangle, color: "text-yellow-600" },
          { key: "expired", label: "Churned", count: stats.totalExpired, Icon: XCircle, color: "text-red-600" },
          { key: "suspended", label: "Suspended", count: stats.totalSuspended, Icon: XCircle, color: "text-muted-foreground" },
        ].map(({ key, label, count, Icon, color }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? "all" : key)}
            className={`rounded-lg border p-3 text-left transition-colors ${filter === key ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"}`}
          >
            <div className={`flex items-center gap-1 ${color}`}>
              <Icon className="size-4" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold mt-1">{count}</div>
          </button>
        ))}
      </div>

      {/* Dealers table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" />
              Dealers ({filtered.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setFilter("all")} disabled={filter === "all"}>
              Show all
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monthly Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const urgency = t.status === "active" && t.expiresAt <= in7
                    ? "row-amber"
                    : t.status === "active" && t.expiresAt <= in30
                    ? "row-yellow"
                    : "";
                  return (
                    <TableRow key={t.id} className={urgency === "row-amber" ? "bg-amber-50/50" : ""}>
                      <TableCell>
                        <div className="font-medium">{t.businessName}</div>
                        <div className="text-xs text-muted-foreground">{t.ownerEmail}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[t.status] ?? "outline"}>
                          {t.status}
                        </Badge>
                        {t.status === "active" && t.expiresAt <= in7 && (
                          <Badge variant="secondary" className="ml-1 text-amber-700 bg-amber-100">⚠ Soon</Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-sm ${t.expiresAt <= today ? "text-destructive font-medium" : t.expiresAt <= in7 ? "text-amber-600 font-medium" : ""}`}>
                        {formatDate(t.expiresAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.planMonths}mo</TableCell>
                      <TableCell>
                        <FeeEditor tenant={t} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No dealers in this category.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

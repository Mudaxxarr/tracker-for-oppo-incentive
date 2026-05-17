import { getRevenueSummary } from "@/lib/admin/dealers";
import { KpiCard } from "@/components/feature/kpi-card";
import { CheckCircle2, Clock, AlertTriangle, XCircle, Users } from "lucide-react";

export default async function AdminRevenuePage() {
  const s = await getRevenueSummary();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Revenue Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Total Dealers"
          value={s.total}
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Active"
          value={s.active}
          icon={<CheckCircle2 className="size-4" />}
        />
        <KpiCard
          label="Expiring in 30 Days"
          value={s.expiringSoon}
          icon={<Clock className="size-4" />}
          highlightZero
        />
        <KpiCard
          label="Grace Period"
          value={s.grace}
          icon={<AlertTriangle className="size-4" />}
          highlightZero
        />
        <KpiCard
          label="Expired"
          value={s.expired}
          icon={<XCircle className="size-4" />}
          highlightZero
        />
        <KpiCard
          label="Suspended"
          value={s.suspended}
          icon={<XCircle className="size-4" />}
          highlightZero
        />
      </div>
    </div>
  );
}

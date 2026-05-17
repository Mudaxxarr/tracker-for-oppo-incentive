import { getDealerDashboardStats } from "./actions";
import { KpiCard } from "@/components/feature/kpi-card";
import { Smartphone, CalendarDays, Package } from "lucide-react";

export default async function DealerDashboardPage() {
  const stats = await getDealerDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {stats.dealerName && (
          <p className="text-sm text-muted-foreground">{stats.dealerName}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Today's Activations"
          value={stats.todayActivations}
          icon={<Smartphone className="size-4" />}
        />
        <KpiCard
          label="Month Activations"
          value={stats.monthActivations}
          icon={<CalendarDays className="size-4" />}
        />
        <KpiCard
          label="Purchase Records"
          value={stats.purchaseRecords}
          icon={<Package className="size-4" />}
        />
      </div>
    </div>
  );
}

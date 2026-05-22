import { getModelsWithThreshold } from "@/lib/db/queries/models";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface Props {
  tenantId: string;
  dealerId: string;
}

export async function LowStockBanner({ tenantId, dealerId }: Props) {
  const [stockRows, thresholds] = await Promise.all([
    listStockForDealer(tenantId, dealerId, OWNER_TENANT_ID),
    getModelsWithThreshold(),
  ]);

  if (thresholds.length === 0) return null;

  const stockMap = new Map(stockRows.map((s) => [s.modelId, s.quantity]));
  const lowItems = thresholds
    .map((t) => ({ name: t.name, stock: stockMap.get(t.id) ?? 0, threshold: t.lowStockThreshold }))
    .filter((item) => item.stock < item.threshold);

  if (lowItems.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2 text-sm">
      <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <span className="font-semibold text-amber-800">Low stock alert: </span>
        <span className="text-amber-700">
          {lowItems.map((item) => `${item.name} (${item.stock} left)`).join(", ")}
        </span>
      </div>
      <Link href="/dealer/inventory" className="text-amber-700 underline shrink-0 text-xs">
        View inventory →
      </Link>
    </div>
  );
}

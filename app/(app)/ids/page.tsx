import { listDealerIds, OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { listStockForDealer } from "@/lib/db/queries/purchases";
import { listInterIdTransfers } from "@/lib/db/queries/transfers";
import { db, schema } from "@/lib/db/client";
import { and, eq } from "drizzle-orm";
import { IdsClient } from "./ids-client";

export default async function IdsPage() {
  // The management page must show hidden IDs — otherwise one could never be un-hidden.
  const dealers = await listDealerIds({ includeHidden: true });
  const models = await listModelsWithCurrentPrice(OWNER_TENANT_ID);

  // Per-ID stats: phone-count = activations count, total-this-month = sum of dealer_price_snapshot * 0.04 for current month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const startStr = startOfMonth.toISOString().slice(0, 10);

  const stats = await Promise.all(
    dealers.map(async (d) => {
      const activations = await db
        .select()
        .from(schema.activations)
        .where(and(eq(schema.activations.tenantId, OWNER_TENANT_ID), eq(schema.activations.dealerId, d.id)));
      const monthly = activations.filter((a) => a.activationDate >= startStr);
      const baseFour = monthly.reduce((s, a) => s + a.dealerPriceSnapshot * 0.04, 0);
      const lastDate = activations.reduce<string | null>(
        (m, a) => (m && a.activationDate <= m ? m : a.activationDate),
        null
      );
      return {
        id: d.id,
        phoneCount: activations.length,
        thisMonthBase: baseFour,
        lastActivity: lastDate,
      };
    })
  );

  // Per-dealer stock (modelIds with positive current stock)
  const stockData = await Promise.all(dealers.map((d) => listStockForDealer(OWNER_TENANT_ID, d.id)));
  const stockByDealer: Record<string, string[]> = {};
  dealers.forEach((d, i) => {
    stockByDealer[d.id] = stockData[i].map((s) => s.modelId);
  });

  // Inter-ID transfers (across all my IDs)
  const allTransfers = (
    await Promise.all(dealers.map((d) => listInterIdTransfers(OWNER_TENANT_ID, d.id)))
  ).flat();
  // de-dup by id
  const transferMap = new Map(allTransfers.map((t) => [t.id, t]));
  const transfers = [...transferMap.values()].sort((a, b) =>
    a.transferDate < b.transferDate ? 1 : -1
  );

  return (
    <IdsClient
      dealers={dealers.map((d) => ({ id: d.id, name: d.name, note: d.note }))}
      models={models}
      stats={Object.fromEntries(stats.map((s) => [s.id, s]))}
      transfers={transfers}
      stockByDealer={stockByDealer}
    />
  );
}

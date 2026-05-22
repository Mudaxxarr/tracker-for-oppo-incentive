import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { listModelsWithCurrentPrice } from "@/lib/db/queries/models";
import { db, schema } from "@/lib/db/client";
import { and, eq, sql } from "drizzle-orm";
import { INTER_ID_STATUS } from "@/lib/constants";
import { LowStockClient } from "./low-stock-client";

export const metadata = { title: "Low-Stock Alerts" };

async function getDealerStockSummary() {
  const today = new Date().toISOString().slice(0, 10);

  const [purchaseRows, activationRows, transferOutRows] = await Promise.all([
    db
      .select({
        tenantId: schema.purchases.tenantId,
        dealerId: schema.purchases.dealerId,
        dealerName: schema.dealerIds.name,
        modelId: schema.purchases.modelId,
        qty: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)`,
      })
      .from(schema.purchases)
      .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.purchases.dealerId))
      .groupBy(schema.purchases.tenantId, schema.purchases.dealerId, schema.dealerIds.name, schema.purchases.modelId),
    db
      .select({
        tenantId: schema.activations.tenantId,
        dealerId: schema.activations.dealerId,
        modelId: schema.activations.modelId,
        qty: sql<number>`COUNT(*)`,
      })
      .from(schema.activations)
      .groupBy(schema.activations.tenantId, schema.activations.dealerId, schema.activations.modelId),
    db
      .select({
        tenantId: schema.interIdTransfers.tenantId,
        dealerId: schema.interIdTransfers.fromDealerId,
        modelId: schema.interIdTransfers.modelId,
        qty: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)`,
      })
      .from(schema.interIdTransfers)
      .where(eq(schema.interIdTransfers.status, INTER_ID_STATUS.ACCEPTED))
      .groupBy(schema.interIdTransfers.tenantId, schema.interIdTransfers.fromDealerId, schema.interIdTransfers.modelId),
  ]);

  type StockKey = string;
  const purchaseMap = new Map<StockKey, { dealerName: string; qty: number }>();
  for (const r of purchaseRows) {
    const key = `${r.tenantId}|${r.dealerId}|${r.modelId}`;
    purchaseMap.set(key, { dealerName: r.dealerName, qty: Number(r.qty) });
  }

  const activationMap = new Map<StockKey, number>();
  for (const r of activationRows) activationMap.set(`${r.tenantId}|${r.dealerId}|${r.modelId}`, Number(r.qty));

  const transferMap = new Map<StockKey, number>();
  for (const r of transferOutRows) transferMap.set(`${r.tenantId}|${r.dealerId}|${r.modelId}`, Number(r.qty));

  const stock = new Map<StockKey, { dealerName: string; tenantId: string; dealerId: string; modelId: string; qty: number }>();
  for (const [key, p] of purchaseMap) {
    const [tenantId, dealerId, modelId] = key.split("|");
    const activated = activationMap.get(key) ?? 0;
    const transferred = transferMap.get(key) ?? 0;
    stock.set(key, { dealerName: p.dealerName, tenantId, dealerId, modelId, qty: p.qty - activated - transferred });
  }

  return stock;
}

export default async function LowStockPage() {
  if (!(await isAuthenticated())) redirect("/login");

  const [models, stockMap] = await Promise.all([
    listModelsWithCurrentPrice(OWNER_TENANT_ID),
    getDealerStockSummary(),
  ]);

  // Build low-stock alerts: for each model with a threshold, find dealers below it
  interface LowStockAlert {
    modelId: string;
    modelName: string;
    threshold: number;
    dealerId: string;
    dealerName: string;
    currentStock: number;
  }

  const alerts: LowStockAlert[] = [];
  for (const [key, s] of stockMap) {
    const model = models.find((m) => m.id === s.modelId);
    if (!model?.lowStockThreshold) continue;
    if (s.qty < model.lowStockThreshold) {
      alerts.push({
        modelId: s.modelId,
        modelName: model.name,
        threshold: model.lowStockThreshold,
        dealerId: s.dealerId,
        dealerName: s.dealerName,
        currentStock: s.qty,
      });
    }
  }

  alerts.sort((a, b) => a.currentStock - b.currentStock);

  return <LowStockClient models={models} alerts={alerts} />;
}

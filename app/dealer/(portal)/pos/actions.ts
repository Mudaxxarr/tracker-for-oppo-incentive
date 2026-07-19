"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant, getTenantById } from "@/lib/dealer-tenant";
import { getPriceOnDate } from "@/lib/db/queries/models";
import { getStockForModelAsOf } from "@/lib/db/queries/purchases";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { INTER_ID_STATUS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { db, schema } from "@/lib/db/client";
import { and, eq, lte, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export type PosSaleState = {
  error?: string;
  activationId?: string;
  pricedAt?: number;
  modelName?: string;
};

const SaleSchema = z.object({
  modelId: z.string().min(1, "Choose a model"),
  imei: z
    .string()
    .trim()
    .regex(/^\d{14,16}$/, "IMEI must be 14–16 digits")
    .optional()
    .or(z.literal("")),
  // Customer: either link existing (customerId) or create new (customerName + customerPhone)
});

export async function createPosSaleAction(
  _prev: PosSaleState,
  fd: FormData
): Promise<PosSaleState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };

  const tenant = await getTenantById(tenantId);
  const backdateDays = tenant?.backdateDays ?? 3;

  const parsed = SaleSchema.safeParse({
    modelId: fd.get("modelId"),
    imei: fd.get("imei") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  const minDate = new Date(Date.now() - backdateDays * 86400000).toISOString().slice(0, 10);
  if (today < minDate) return { error: "Date window error" };

  // Pre-check stock
  const stock = await getStockForModelAsOf(tenantId, dealerId, d.modelId, today);
  if (stock < 1) return { error: "No stock available for this model today." };

  const priceData = await getPriceOnDate(OWNER_TENANT_ID, d.modelId, today);
  if (!priceData) return { error: "No dealer price defined for this model on or before today" };
  const pricedAt = priceData.dealerPrice;

  // Fetch model name for return
  const modelRows = await db
    .select({ name: schema.models.name })
    .from(schema.models)
    .where(eq(schema.models.id, d.modelId))
    .limit(1);
  const modelName = modelRows[0]?.name ?? d.modelId;

  let activationId: string;

  try {
    await db.transaction(async (tx) => {
      // Stock re-check inside transaction
      const [[{ pq }], [{ aq }], [{ tq }]] = await Promise.all([
        tx.select({ pq: sql<number>`COALESCE(SUM(${schema.purchases.quantity}), 0)` })
          .from(schema.purchases)
          .where(and(
            eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId),
            eq(schema.purchases.modelId, d.modelId), lte(schema.purchases.purchaseDate, today),
          )),
        tx.select({ aq: sql<number>`COUNT(*)` })
          .from(schema.activations)
          .where(and(
            eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId),
            eq(schema.activations.modelId, d.modelId), lte(schema.activations.activationDate, today),
          )),
        tx.select({ tq: sql<number>`COALESCE(SUM(${schema.interIdTransfers.quantity}), 0)` })
          .from(schema.interIdTransfers)
          .where(and(
            eq(schema.interIdTransfers.tenantId, tenantId), eq(schema.interIdTransfers.fromDealerId, dealerId),
            eq(schema.interIdTransfers.modelId, d.modelId), lte(schema.interIdTransfers.transferDate, today),
            ne(schema.interIdTransfers.status, INTER_ID_STATUS.REJECTED),
          )),
      ]);
      const txStock = Number(pq) - Number(aq) - Number(tq);
      if (txStock < 1) throw new Error("No stock available for this model today.");

      const newId = randomUUID();
      activationId = newId;
      await tx.insert(schema.activations).values({
        id: newId,
        tenantId,
        dealerId,
        modelId: d.modelId,
        imei: d.imei || null,
        activationDate: today,
        purchaseId: null,
        isCrossRegion: false,
        dealerPriceSnapshot: pricedAt,
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sale failed. Please retry." };
  }

  await logAudit({
    action: "pos.sale",
    entityType: "activation",
    entityId: activationId!,
    dealerId,
    summary: `[Dealer] POS sale: ${modelName} @ PKR ${pricedAt}`,
  });
  revalidatePath("/dealer/activations");
  revalidatePath("/dealer/pos");
  // POS sale deducts stock like any other activation → recompute rebate eligibility.
  reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, d.modelId, today, tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));

  return { activationId: activationId!, pricedAt, modelName };
}

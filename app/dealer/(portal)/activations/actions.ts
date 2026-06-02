"use server";

import { revalidatePath } from "next/cache";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant, getTenantById } from "@/lib/dealer-tenant";
import { listActivations, createActivation, deleteActivation, getActivationById } from "@/lib/db/queries/activations";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { listModelsWithCurrentPrice, getPriceOnDate } from "@/lib/db/queries/models";
import { getMinForwardStock, listStockForDealer } from "@/lib/db/queries/purchases";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { CROSS_REGION_STATUS, INTER_ID_STATUS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { todayPKT } from "@/lib/format";
import { db, schema } from "@/lib/db/client";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

async function requireSession() {
  const session = await getDealerSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function listDealerActivationsAction() {
  const session = await requireSession();
  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) return { activations: [], models: [], stock: [] };

  const [activations, models, stock] = await Promise.all([
    listActivations({ tenantId, dealerId }),
    listModelsWithCurrentPrice(OWNER_TENANT_ID),
    listStockForDealer(tenantId, dealerId, OWNER_TENANT_ID),
  ]);
  return { activations, models, stock };
}

export type ActivationFormState = {
  error?: string;
  ok?: boolean;
  pricedAt?: number;
  inserted?: number;
};

const ActivationSchema = z.object({
  modelId: z.string().min(1, "Choose a model"),
  activationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  quantity: z.coerce.number().int().positive().optional(),
  imei: z
    .string()
    .trim()
    .regex(/^\d{14,16}$/, "IMEI must be 14–16 digits")
    .optional()
    .or(z.literal("")),
  isCrossRegion: z.union([z.literal("on"), z.literal("")]).optional(),
});

export async function createDealerActivationAction(
  _prev: ActivationFormState,
  formData: FormData,
): Promise<ActivationFormState> {
  const session = await requireSession();
  const { tenantId, userId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) return { error: "No active dealer ID selected." };

  // H-A: load per-dealer backdate window
  const tenant = await getTenantById(tenantId);
  const backdateDays = tenant?.backdateDays ?? 3;

  const parsed = ActivationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const d = parsed.data;
  const qty = d.quantity ?? 1;
  const isCrossRegion = d.isCrossRegion === "on";

  if (qty > 1 && d.imei) return { error: "IMEI can only be set when quantity is 1." };

  // H-A: enforce date window — no future dates, no dates beyond backdate allowance
  const today = todayPKT();
  const minDate = todayPKT(-backdateDays);
  if (d.activationDate > today) return { error: "Activation date cannot be in the future." };
  if (d.activationDate < minDate) return { error: `Activation date cannot be more than ${backdateDays} day(s) in the past.` };

  // H-D: isCrossRegion flag requires an approved cross-region transfer record for this model
  if (isCrossRegion) {
    const crRecords = await db
      .select({ id: schema.crossRegionTransfers.id })
      .from(schema.crossRegionTransfers)
      .where(and(
        eq(schema.crossRegionTransfers.tenantId, tenantId),
        eq(schema.crossRegionTransfers.dealerId, dealerId),
        eq(schema.crossRegionTransfers.modelId, d.modelId),
        eq(schema.crossRegionTransfers.status, CROSS_REGION_STATUS.SHIFTED_TO_MY_ID),
        lte(schema.crossRegionTransfers.shiftedToIdDate, d.activationDate),
      ))
      .limit(1);
    if (crRecords.length === 0) {
      return { error: "Cross-region flag requires an approved cross-region transfer for this model on or before this date." };
    }
  }

  // Pre-check stock for fast UX feedback (forward-minimum guards backdating oversell)
  const stock = await getMinForwardStock(tenantId, dealerId, d.modelId, d.activationDate);
  if (stock < qty) return { error: `Only ${stock} unit(s) available from ${d.activationDate} onward.` };

  const priceData = await getPriceOnDate(OWNER_TENANT_ID, d.modelId, d.activationDate);
  const pricedAt = priceData?.dealerPrice ?? 0;

  // CR-3: wrap stock re-check + inserts in a transaction to prevent TOCTOU
  try {
    await db.transaction(async (tx) => {
      const txStock = await getMinForwardStock(tenantId, dealerId, d.modelId, d.activationDate, tx);
      if (txStock < qty) {
        throw new Error(`Only ${txStock} unit(s) available from ${d.activationDate} onward.`);
      }
      for (let i = 0; i < qty; i++) {
        await tx.insert(schema.activations).values({
          id: randomUUID(), tenantId, dealerId, modelId: d.modelId,
          imei: qty === 1 && d.imei ? d.imei : null,
          activationDate: d.activationDate, purchaseId: null,
          isCrossRegion, dealerPriceSnapshot: pricedAt,
        });
      }
    });
    await logAudit({
      action: "dealer_activation_created",
      summary: `Dealer activation: ${qty} unit(s)`,
      payload: { tenantId, dealerId, qty, userId },
      dealerId,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/dealer/activations");
  revalidatePath("/dealer/dashboard");
  await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, d.modelId, d.activationDate, tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true, inserted: qty, pricedAt };
}

const BulkByDateRowSchema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  isCrossRegion: z.boolean().optional(),
});

const BulkByDateSchema = z.object({
  activationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  rows: z.array(BulkByDateRowSchema).min(1, "Add at least one model"),
});

export async function bulkCreateDealerActivationsByDateAction(
  _prev: ActivationFormState,
  formData: FormData,
): Promise<ActivationFormState> {
  const session = await requireSession();
  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) return { error: "No active dealer ID." };

  // H-A: load per-dealer backdate window
  const tenant = await getTenantById(tenantId);
  const backdateDays = tenant?.backdateDays ?? 3;

  let rawRows: unknown;
  try {
    rawRows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "Invalid rows data." };
  }

  const parsed = BulkByDateSchema.safeParse({
    activationDate: formData.get("activationDate"),
    rows: rawRows,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { activationDate, rows } = parsed.data;

  // H-A: enforce date window
  const today = todayPKT();
  const minDate = todayPKT(-backdateDays);
  if (activationDate > today) return { error: "Activation date cannot be in the future." };
  if (activationDate < minDate) return { error: `Activation date cannot be more than ${backdateDays} day(s) in the past.` };

  // Aggregate requested qty per model so duplicate rows share one stock check.
  const perModel = new Map<string, number>();
  for (const row of rows) perModel.set(row.modelId, (perModel.get(row.modelId) ?? 0) + row.quantity);

  // Pre-check each model's forward-minimum stock for fast UX feedback.
  for (const [modelId, totalQty] of perModel) {
    const stock = await getMinForwardStock(tenantId, dealerId, modelId, activationDate);
    if (stock < totalQty) {
      return { error: `Insufficient stock for a model from ${activationDate} onward.` };
    }
  }

  // Collect prices per row.
  type RowData = { modelId: string; quantity: number; isCrossRegion: boolean; price: number };
  const rowData: RowData[] = [];
  let pricedAt = 0;
  for (const row of rows) {
    const priceData = await getPriceOnDate(OWNER_TENANT_ID, row.modelId, activationDate);
    const price = priceData?.dealerPrice ?? 0;
    pricedAt += price * row.quantity;
    rowData.push({ modelId: row.modelId, quantity: row.quantity, isCrossRegion: row.isCrossRegion ?? false, price });
  }

  let inserted = 0;
  // H-E: wrap stock re-check + all inserts in a single transaction (all-or-nothing, TOCTOU-safe)
  try {
    await db.transaction(async (tx) => {
      for (const [modelId, totalQty] of perModel) {
        const txStock = await getMinForwardStock(tenantId, dealerId, modelId, activationDate, tx);
        if (txStock < totalQty) {
          throw new Error(`Insufficient stock for a model from ${activationDate} onward.`);
        }
      }
      for (const row of rowData) {
        for (let i = 0; i < row.quantity; i++) {
          await tx.insert(schema.activations).values({
            id: randomUUID(), tenantId, dealerId, modelId: row.modelId,
            imei: null, activationDate, purchaseId: null,
            isCrossRegion: row.isCrossRegion, dealerPriceSnapshot: row.price,
          });
          inserted++;
        }
      }
    });
    await logAudit({
      action: "dealer_activation_bulk_created",
      summary: `Dealer bulk activation: ${inserted} unit(s) on ${activationDate}`,
      payload: { tenantId, dealerId, inserted, activationDate },
      dealerId,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/dealer/activations");
  revalidatePath("/dealer/dashboard");
  for (const row of rowData) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, row.modelId, activationDate, tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
  return { ok: true, inserted, pricedAt };
}

export async function deleteDealerActivationAction(id: string): Promise<void> {
  const session = await requireSession();
  const { tenantId, role } = session;
  if (role === "exec") throw new Error("Exec users cannot delete activations.");

  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) throw new Error("No active dealer ID.");

  const activation = await getActivationById(id, dealerId, tenantId);
  await deleteActivation(id, dealerId, tenantId);
  await logAudit({
    action: "dealer_activation_deleted",
    summary: `Dealer activation deleted: ${id.slice(0, 8)}`,
    dealerId,
  });
  revalidatePath("/dealer/activations");
  revalidatePath("/dealer/dashboard");
  if (activation) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, activation.modelId, activation.activationDate, tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
}

export async function bulkDeleteDealerActivationsAction(
  ids: string[],
): Promise<{ deleted: number }> {
  const session = await requireSession();
  const { tenantId, role } = session;
  if (role === "exec") throw new Error("Exec users cannot delete activations.");

  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) throw new Error("No active dealer ID.");

  const activationRecords = (
    await Promise.all(ids.map((id) => getActivationById(id, dealerId, tenantId)))
  ).filter((a): a is NonNullable<typeof a> => a !== null && a !== undefined);

  let deleted = 0;
  await db.transaction(async () => {
    for (const id of ids) {
      await deleteActivation(id, dealerId, tenantId);
      deleted++;
    }
  });

  await logAudit({
    action: "dealer_activation_bulk_deleted",
    summary: `Dealer bulk deleted ${deleted} activation(s)`,
    dealerId,
  });
  revalidatePath("/dealer/activations");
  revalidatePath("/dealer/dashboard");

  const byModel = new Map<string, string>();
  for (const a of activationRecords) {
    const existing = byModel.get(a.modelId);
    if (!existing || a.activationDate < existing) byModel.set(a.modelId, a.activationDate);
  }
  for (const [modelId, fromDate] of byModel) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, modelId, fromDate, tenantId).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }

  return { deleted };
}

export interface ModelQtyRow {
  modelId: string;
  modelName: string;
  qty: number;
}

export interface DailyModelRow {
  date: string;
  models: ModelQtyRow[];
}

export async function getDealerActivationSummaryAction(
  from: string,
  to: string,
): Promise<ModelQtyRow[]> {
  const session = await requireSession();
  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) return [];

  const rows = await db
    .select({
      modelId: schema.activations.modelId,
      modelName: schema.models.name,
      qty: sql<number>`COUNT(*)`.as("qty"),
    })
    .from(schema.activations)
    .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
    .where(
      and(
        eq(schema.activations.tenantId, tenantId),
        eq(schema.activations.dealerId, dealerId),
        gte(schema.activations.activationDate, from),
        lte(schema.activations.activationDate, to),
      ),
    )
    .groupBy(schema.activations.modelId, schema.models.name)
    .orderBy(desc(sql`COUNT(*)`), asc(schema.models.name));

  return rows.map((r) => ({ ...r, qty: Number(r.qty) }));
}

export async function getDealerDailyActivationsAction(
  from: string,
  to: string,
): Promise<DailyModelRow[]> {
  const session = await requireSession();
  const { tenantId } = session;
  const dealerId = await getActiveDealerIdForTenant(tenantId);
  if (!dealerId) return [];

  const rows = await db
    .select({
      date: schema.activations.activationDate,
      modelId: schema.activations.modelId,
      modelName: schema.models.name,
      qty: sql<number>`COUNT(*)`.as("qty"),
    })
    .from(schema.activations)
    .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
    .where(
      and(
        eq(schema.activations.tenantId, tenantId),
        eq(schema.activations.dealerId, dealerId),
        gte(schema.activations.activationDate, from),
        lte(schema.activations.activationDate, to),
      ),
    )
    .groupBy(
      schema.activations.activationDate,
      schema.activations.modelId,
      schema.models.name,
    )
    .orderBy(desc(schema.activations.activationDate), asc(schema.models.name));

  const byDate = new Map<string, ModelQtyRow[]>();
  for (const r of rows) {
    const entry = byDate.get(r.date) ?? [];
    entry.push({ modelId: r.modelId, modelName: r.modelName, qty: Number(r.qty) });
    byDate.set(r.date, entry);
  }

  return [...byDate.entries()]
    .map(([date, models]) => ({ date, models }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

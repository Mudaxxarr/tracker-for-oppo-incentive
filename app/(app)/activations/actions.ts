"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated, isAnyAuthenticated } from "@/lib/auth";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { db } from "@/lib/db/client";
import {
  createActivation,
  deleteActivation,
  getActivationById,
  updateActivation,
} from "@/lib/db/queries/activations";
import { getModelById, getPriceOnDate } from "@/lib/db/queries/models";
import { getMinForwardStock } from "@/lib/db/queries/purchases";
import { createOwnerAlert } from "@/lib/db/queries/alerts";
import { OWNER_ALERT_TYPE } from "@/lib/constants";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { logAudit } from "@/lib/audit";
import { formatPKR } from "@/lib/format";

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
  purchaseId: z.string().optional(),
  isCrossRegion: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional(),
});

const BulkByDateRowSchema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  isCrossRegion: z.boolean().optional(),
});

const BulkByDateSchema = z.object({
  activationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  rows: z.array(BulkByDateRowSchema).min(1, "Add at least one model"),
});

export type ActivationFormState = {
  error?: string;
  ok?: boolean;
  pricedAt?: number;
  inserted?: number;
  skipped?: number;
  invalid?: number;
};

export async function createActivationAction(
  _prev: ActivationFormState,
  formData: FormData
): Promise<ActivationFormState> {
  if (!(await isAnyAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const parsed = ActivationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    await logAudit({
      action: "activation.create",
      status: "error",
      summary: `Activation rejected: ${parsed.error.issues[0].message}`,
    });
    return { error: parsed.error.issues[0].message };
  }
  const data = parsed.data;
  const qty = data.quantity ?? 1;
  if (qty > 1 && data.imei) {
    return { error: "IMEI can only be set when quantity is 1" };
  }
  try {
    const isCR = data.isCrossRegion === "on" || data.isCrossRegion === "true";

    if (qty === 1) {
      let stockError: string | null = null;
      let singleResult: { id: string; pricedAt: number; isCrossRegion: boolean } | undefined;
      await db.transaction(async () => {
        const stock = await getMinForwardStock(tenantId, dealerId, data.modelId, data.activationDate);
        if (stock < 1) {
          const m = await getModelById(data.modelId);
          stockError = `Only ${stock} ${m?.name ?? "unit(s)"} available from ${data.activationDate} onward — cannot activate 1`;
          return;
        }
        singleResult = await createActivation({
          tenantId,
          dealerId,
          modelId: data.modelId,
          activationDate: data.activationDate,
          imei: data.imei ? data.imei : null,
          purchaseId: data.purchaseId || null,
          isCrossRegion: isCR,
        });
      });
      if (stockError) return { error: stockError };
      if (!singleResult) return { error: "Failed to create activation" };
      const m = await getModelById(data.modelId);
      await logAudit({
        action: "activation.create",
        entityType: "activation",
        entityId: singleResult.id,
        summary: `Activated 1 × ${m?.name ?? "?"} @ ${formatPKR(singleResult.pricedAt)}${
          data.imei ? ` (IMEI ••••${data.imei.slice(-6)})` : ""
        }`,
        payload: {
          modelId: data.modelId,
          activationDate: data.activationDate,
          imei: data.imei || null,
          dealerPriceSnapshot: singleResult.pricedAt,
          isCrossRegion: singleResult.isCrossRegion,
        },
      });
      revalidatePath("/activations");
      revalidatePath("/dashboard");
      await reEvaluateRebatesForDealer(tenantId, dealerId, data.modelId, data.activationDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
      return { ok: true, pricedAt: singleResult.pricedAt };
    }

    const price = await getPriceOnDate(tenantId, data.modelId, data.activationDate);
    if (!price) {
      return {
        error: "No dealer price defined for this model on or before the activation date",
      };
    }
    let inserted = 0;
    let bulkStockError: string | null = null;
    await db.transaction(async () => {
      const stock = await getMinForwardStock(tenantId, dealerId, data.modelId, data.activationDate);
      if (qty > stock) {
        const m = await getModelById(data.modelId);
        bulkStockError = `Only ${stock} ${m?.name ?? "unit(s)"} available from ${data.activationDate} onward — cannot activate ${qty}`;
        return;
      }
      for (let i = 0; i < qty; i++) {
        await createActivation({
          tenantId,
          dealerId,
          modelId: data.modelId,
          activationDate: data.activationDate,
          imei: null,
          purchaseId: null,
          isCrossRegion: isCR,
          dealerPriceOverride: price.dealerPrice,
        });
        inserted += 1;
      }
    });
    if (bulkStockError) return { error: bulkStockError };
    const m = await getModelById(data.modelId);
    await logAudit({
      action: "activation.bulk_qty",
      entityType: "activation",
      summary: `Activated ${inserted} × ${m?.name ?? "?"} @ ${formatPKR(price.dealerPrice)} (qty entry)`,
      payload: {
        modelId: data.modelId,
        activationDate: data.activationDate,
        quantity: inserted,
        dealerPriceSnapshot: price.dealerPrice,
        isCrossRegion: isCR,
      },
    });
    revalidatePath("/activations");
    revalidatePath("/dashboard");
    await reEvaluateRebatesForDealer(tenantId, dealerId, data.modelId, data.activationDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
    return { ok: true, pricedAt: price.dealerPrice, inserted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to add activation";
    await logAudit({
      action: "activation.create",
      status: "error",
      summary: `Activation create failed: ${msg}`,
    });
    return { error: msg };
  }
}

export async function bulkCreateActivationsByDateAction(
  _prev: ActivationFormState,
  formData: FormData
): Promise<ActivationFormState> {
  if (!(await isAnyAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const rowsRaw = formData.get("rows");
  let rows: unknown = [];
  if (typeof rowsRaw === "string" && rowsRaw.length > 0) {
    try {
      rows = JSON.parse(rowsRaw);
    } catch {
      return { error: "Malformed rows payload" };
    }
  }

  const parsed = BulkByDateSchema.safeParse({
    activationDate: formData.get("activationDate"),
    rows,
  });
  if (!parsed.success) {
    await logAudit({
      action: "activation.bulk_by_date",
      status: "error",
      summary: `Bulk-by-date rejected: ${parsed.error.issues[0].message}`,
    });
    return { error: parsed.error.issues[0].message };
  }

  // Merge duplicate models into a single row so stock checks aggregate properly.
  const merged = new Map<string, { quantity: number; isCrossRegion: boolean }>();
  for (const r of parsed.data.rows) {
    const prev = merged.get(r.modelId);
    if (prev) {
      // If any contributing row was cross-region we keep the flag — splitting per
      // flag would change row count for the same model on the same date.
      merged.set(r.modelId, {
        quantity: prev.quantity + r.quantity,
        isCrossRegion: prev.isCrossRegion || !!r.isCrossRegion,
      });
    } else {
      merged.set(r.modelId, { quantity: r.quantity, isCrossRegion: !!r.isCrossRegion });
    }
  }

  // Wrap stock-check + inserts in a single transaction so concurrent requests
  // cannot both pass the same stock check and oversell.
  const prepared: {
    modelId: string;
    modelName: string;
    quantity: number;
    isCrossRegion: boolean;
    price: number;
  }[] = [];
  let inserted = 0;
  let totalValue = 0;

  try {
    await db.transaction(async () => {
      for (const [modelId, r] of merged) {
        const stock = await getMinForwardStock(tenantId, dealerId, modelId, parsed.data.activationDate);
        const model = await getModelById(modelId);
        if (r.quantity > stock) {
          throw new Error(
            `Only ${stock} ${model?.name ?? "unit(s)"} available from ${parsed.data.activationDate} onward — cannot activate ${r.quantity}`,
          );
        }
        const price = await getPriceOnDate(tenantId, modelId, parsed.data.activationDate);
        if (!price) {
          throw new Error(
            `No dealer price defined for ${model?.name ?? "model"} on or before ${parsed.data.activationDate}`,
          );
        }
        prepared.push({
          modelId,
          modelName: model?.name ?? "?",
          quantity: r.quantity,
          isCrossRegion: r.isCrossRegion,
          price: price.dealerPrice,
        });
      }

      for (const row of prepared) {
        for (let i = 0; i < row.quantity; i++) {
          await createActivation({
            tenantId,
            dealerId,
            modelId: row.modelId,
            activationDate: parsed.data.activationDate,
            imei: null,
            purchaseId: null,
            isCrossRegion: row.isCrossRegion,
            dealerPriceOverride: row.price,
          });
          inserted += 1;
          totalValue += row.price;
        }
      }
    });

    await logAudit({
      action: "activation.bulk_by_date",
      entityType: "activation",
      summary: `Bulk-by-date activated ${inserted} unit(s) across ${prepared.length} model(s) on ${parsed.data.activationDate} (${formatPKR(totalValue)})`,
      payload: {
        activationDate: parsed.data.activationDate,
        rows: prepared.map((p) => ({
          modelId: p.modelId,
          modelName: p.modelName,
          quantity: p.quantity,
          dealerPriceSnapshot: p.price,
          isCrossRegion: p.isCrossRegion,
        })),
        inserted,
      },
    });

    revalidatePath("/activations");
    revalidatePath("/dashboard");
    for (const [modelId] of merged) {
      await reEvaluateRebatesForDealer(tenantId, dealerId, modelId, parsed.data.activationDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
    }
    return { ok: true, inserted, pricedAt: totalValue };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to bulk-activate";
    await logAudit({
      action: "activation.bulk_by_date",
      status: "error",
      summary: `Bulk-by-date failed: ${msg}`,
    });
    return { error: msg };
  }
}

const UpdateActivationSchema = z.object({
  id: z.string().min(1),
  modelId: z.string().min(1),
  activationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  imei: z
    .string()
    .trim()
    .regex(/^\d{14,16}$/, "IMEI must be 14–16 digits")
    .optional()
    .or(z.literal("")),
  isCrossRegion: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional(),
});

export async function updateActivationAction(
  _prev: ActivationFormState,
  formData: FormData
): Promise<ActivationFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const parsed = UpdateActivationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const existing = await getActivationById(data.id, dealerId, tenantId);
  if (!existing) return { error: "Activation not found" };

  const price = await getPriceOnDate(tenantId, data.modelId, data.activationDate);
  if (!price) {
    return { error: `No dealer price defined for this model on ${data.activationDate}` };
  }

  const isCR = data.isCrossRegion === "on" || data.isCrossRegion === "true";

  // Apply the move inside a transaction, then assert stock stays >= 0 on every
  // date from the new date onward. If it would oversell, throw to roll back.
  let guardError: string | null = null;
  try {
    await db.transaction(async () => {
      await updateActivation(data.id, dealerId, tenantId, {
        activationDate: data.activationDate,
        imei: data.imei || null,
        isCrossRegion: isCR,
        dealerPriceSnapshot: price.dealerPrice,
      });
      const minStock = await getMinForwardStock(tenantId, dealerId, data.modelId, data.activationDate);
      if (minStock < 0) {
        const m = await getModelById(data.modelId);
        guardError = `Cannot move activation to ${data.activationDate} — it would oversell ${m?.name ?? "this model"} (stock goes negative).`;
        throw new Error("GUARD_ROLLBACK");
      }
    });
  } catch (err) {
    if (guardError) return { error: guardError };
    return { error: err instanceof Error ? err.message : "Failed to update activation" };
  }

  const m = await getModelById(data.modelId);
  await logAudit({
    action: "activation.update",
    entityType: "activation",
    entityId: data.id,
    summary: `Updated activation ${data.id.slice(0, 8)}: date=${data.activationDate}, ${m?.name ?? "?"} @ ${formatPKR(price.dealerPrice)}`,
  });
  revalidatePath("/activations");
  revalidatePath("/dashboard");
  const triggerDate = data.activationDate < existing.activationDate
    ? data.activationDate
    : existing.activationDate;
  await reEvaluateRebatesForDealer(tenantId, dealerId, data.modelId, triggerDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return { ok: true, pricedAt: price.dealerPrice };
}

export async function deleteActivationAction(id: string): Promise<void> {
  if (!(await isAuthenticated())) return;
  const dealerId = await getActiveDealerId();
  if (!dealerId) return;
  const activation = await getActivationById(id, dealerId, OWNER_TENANT_ID);
  await deleteActivation(id, dealerId, OWNER_TENANT_ID);
  await logAudit({
    action: "activation.delete",
    entityType: "activation",
    entityId: id,
    summary: `Deleted activation ${id.slice(0, 8)}`,
  });
  revalidatePath("/activations");
  revalidatePath("/dashboard");
  if (activation) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, activation.modelId, activation.activationDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
}

export async function bulkDeleteActivationsAction(
  ids: string[]
): Promise<{ deleted: number }> {
  if (!(await isAuthenticated())) return { deleted: 0 };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { deleted: 0 };
  const tenantId = OWNER_TENANT_ID;

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
    action: "activation.bulk_delete",
    summary: `Bulk deleted ${deleted} activation(s)`,
    payload: { ids },
  });
  revalidatePath("/activations");
  revalidatePath("/dashboard");

  const byModel = new Map<string, string>();
  for (const a of activationRecords) {
    const existing = byModel.get(a.modelId);
    if (!existing || a.activationDate < existing) byModel.set(a.modelId, a.activationDate);
  }
  for (const [modelId, fromDate] of byModel) {
    await reEvaluateRebatesForDealer(tenantId, dealerId, modelId, fromDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }

  return { deleted };
}

export async function requestActivationDeletionAction(
  activationId: string
): Promise<{ ok?: boolean; error?: string }> {
  if (!(await isAnyAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;

  const activation = await getActivationById(activationId, dealerId, tenantId);
  if (!activation) return { error: "Activation not found" };

  const m = await getModelById(activation.modelId);
  await createOwnerAlert({
    tenantId,
    type: OWNER_ALERT_TYPE.ACTIVATION_DELETION_REQUEST,
    entityType: "activation",
    entityId: activationId,
    dealerId,
    message: `SO requested deletion of activation: ${m?.name ?? "?"} on ${activation.activationDate}${activation.imei ? ` (IMEI ••••${activation.imei.slice(-6)})` : ""}`,
  });

  await logAudit({
    action: "activation.delete_requested",
    entityType: "activation",
    entityId: activationId,
    summary: `SO requested deletion of activation ${activationId.slice(0, 8)}`,
  });

  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated, isAnyAuthenticated } from "@/lib/auth";
import { getActiveDealerId } from "@/lib/dealer";
import { db } from "@/lib/db/client";
import {
  createActivation,
  deleteActivation,
} from "@/lib/db/queries/activations";
import { getModelById, getPriceOnDate } from "@/lib/db/queries/models";
import { getStockForModelAsOf } from "@/lib/db/queries/purchases";
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
    const stock = await getStockForModelAsOf(dealerId, data.modelId, data.activationDate);
    if (qty > stock) {
      const m = await getModelById(data.modelId);
      return {
        error: `Only ${stock} ${m?.name ?? "unit(s)"} available as of ${data.activationDate} — cannot activate ${qty}`,
      };
    }
    const isCR = data.isCrossRegion === "on" || data.isCrossRegion === "true";
    if (qty === 1) {
      const result = await createActivation({
        dealerId,
        modelId: data.modelId,
        activationDate: data.activationDate,
        imei: data.imei ? data.imei : null,
        purchaseId: data.purchaseId || null,
        isCrossRegion: isCR,
      });
      const m = await getModelById(data.modelId);
      await logAudit({
        action: "activation.create",
        entityType: "activation",
        entityId: result.id,
        summary: `Activated 1 × ${m?.name ?? "?"} @ ${formatPKR(result.pricedAt)}${
          data.imei ? ` (IMEI ••••${data.imei.slice(-6)})` : ""
        }`,
        payload: {
          modelId: data.modelId,
          activationDate: data.activationDate,
          imei: data.imei || null,
          dealerPriceSnapshot: result.pricedAt,
          isCrossRegion: result.isCrossRegion,
        },
      });
      revalidatePath("/activations");
      revalidatePath("/dashboard");
      return { ok: true, pricedAt: result.pricedAt };
    }

    const price = await getPriceOnDate(data.modelId, data.activationDate);
    if (!price) {
      return {
        error: "No dealer price defined for this model on or before the activation date",
      };
    }
    let inserted = 0;
    await db.transaction(async () => {
      for (let i = 0; i < qty; i++) {
        await createActivation({
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
        const stock = await getStockForModelAsOf(dealerId, modelId, parsed.data.activationDate);
        const model = await getModelById(modelId);
        if (r.quantity > stock) {
          throw new Error(
            `Only ${stock} ${model?.name ?? "unit(s)"} available as of ${parsed.data.activationDate} — cannot activate ${r.quantity}`,
          );
        }
        const price = await getPriceOnDate(modelId, parsed.data.activationDate);
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

export async function deleteActivationAction(id: string): Promise<void> {
  if (!(await isAuthenticated())) return;
  const dealerId = await getActiveDealerId();
  if (!dealerId) return;
  await deleteActivation(id, dealerId);
  await logAudit({
    action: "activation.delete",
    entityType: "activation",
    entityId: id,
    summary: `Deleted activation ${id.slice(0, 8)}`,
  });
  revalidatePath("/activations");
  revalidatePath("/dashboard");
}

export async function bulkDeleteActivationsAction(
  ids: string[]
): Promise<{ deleted: number }> {
  if (!(await isAuthenticated())) return { deleted: 0 };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { deleted: 0 };
  let deleted = 0;
  await db.transaction(async () => {
    for (const id of ids) {
      await deleteActivation(id, dealerId);
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
  return { deleted };
}

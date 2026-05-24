"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import {
  addPriceEntry,
  createModel,
  deleteModel,
  deletePriceEntry,
  getModelById,
  updateModel,
  updatePriceEntry,
} from "@/lib/db/queries/models";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { logAudit } from "@/lib/audit";
import { formatPKR } from "@/lib/format";

async function requireSession() {
  const session = await getDealerSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

const CreateModelSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().max(80).optional().nullable(),
  dealerPrice: z.coerce.number().nonnegative(),
  invoicePrice: z.coerce.number().nonnegative(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const UpdateModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().max(80).optional().nullable(),
  isActive: z.union([z.literal("on"), z.literal("true"), z.literal("")]).optional(),
});

const AddPriceSchema = z.object({
  modelId: z.string().min(1),
  dealerPrice: z.coerce.number().nonnegative(),
  invoicePrice: z.coerce.number().nonnegative(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ModelFormState = { error?: string; ok?: boolean; id?: string };

export async function createDealerModelAction(
  _prev: ModelFormState,
  fd: FormData,
): Promise<ModelFormState> {
  const session = await requireSession();
  const obj = Object.fromEntries(fd);
  if (obj.sku === "") delete (obj as Record<string, unknown>).sku;
  const parsed = CreateModelSchema.safeParse(obj);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = await createModel(OWNER_TENANT_ID, {
    name: parsed.data.name,
    sku: parsed.data.sku ?? null,
    dealerPrice: parsed.data.dealerPrice,
    invoicePrice: parsed.data.invoicePrice,
    effectiveFrom: parsed.data.effectiveFrom,
  });
  await logAudit({
    action: "model.create",
    entityType: "model",
    entityId: id,
    summary: `[Dealer] Added model "${parsed.data.name}" @ ${formatPKR(parsed.data.dealerPrice)}`,
    payload: parsed.data,
  });
  revalidatePath("/dealer/models");
  revalidatePath("/dealer/purchases");
  revalidatePath("/dealer/activations");
  return { ok: true, id };
}

export async function updateDealerModelAction(
  _prev: ModelFormState,
  fd: FormData,
): Promise<ModelFormState> {
  await requireSession();
  const parsed = UpdateModelSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const before = await getModelById(parsed.data.id);
  if (!before) return { error: "Model not found" };
  await updateModel({
    id: parsed.data.id,
    name: parsed.data.name,
    sku: parsed.data.sku ? parsed.data.sku : null,
    isActive: parsed.data.isActive === "on" || parsed.data.isActive === "true",
  });
  await logAudit({
    action: "model.update",
    entityType: "model",
    entityId: parsed.data.id,
    summary: `[Dealer] Updated model "${before.name}" → "${parsed.data.name}"`,
  });
  revalidatePath("/dealer/models");
  revalidatePath("/dealer/purchases");
  revalidatePath("/dealer/activations");
  return { ok: true };
}

export async function addDealerPriceEntryAction(
  _prev: ModelFormState,
  fd: FormData,
): Promise<ModelFormState> {
  await requireSession();
  const parsed = AddPriceSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const m = await getModelById(parsed.data.modelId);
  if (!m) return { error: "Model not found" };
  const id = await addPriceEntry(OWNER_TENANT_ID, parsed.data);
  await logAudit({
    action: "model.price_entry.add",
    entityType: "model",
    entityId: parsed.data.modelId,
    summary: `[Dealer] Added price for "${m.name}": ${formatPKR(parsed.data.dealerPrice)} dealer / ${formatPKR(parsed.data.invoicePrice)} invoice (from ${parsed.data.effectiveFrom})`,
    payload: { ...parsed.data, priceEntryId: id },
  });
  revalidatePath("/dealer/models");
  revalidatePath("/dealer/purchases");
  revalidatePath("/dealer/activations");
  return { ok: true, id };
}

export async function updateDealerPriceEntryAction(input: {
  modelId: string;
  priceId: string;
  dealerPrice: number;
  invoicePrice: number;
  effectiveFrom: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSession();
  } catch {
    return { ok: false, error: "Not authenticated" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom))
    return { ok: false, error: "Invalid effective date" };
  if (!Number.isFinite(input.dealerPrice) || input.dealerPrice < 0)
    return { ok: false, error: "Dealer price must be ≥ 0" };
  if (!Number.isFinite(input.invoicePrice) || input.invoicePrice < 0)
    return { ok: false, error: "Invoice price must be ≥ 0" };
  const m = await getModelById(input.modelId);
  if (!m) return { ok: false, error: "Model not found" };
  await updatePriceEntry(OWNER_TENANT_ID, input);
  await logAudit({
    action: "model.price_entry.update",
    entityType: "model",
    entityId: input.modelId,
    summary: `[Dealer] Edited price entry for "${m.name}": ${formatPKR(input.dealerPrice)} dealer (from ${input.effectiveFrom})`,
  });
  revalidatePath("/dealer/models");
  revalidatePath("/dealer/purchases");
  revalidatePath("/dealer/activations");
  return { ok: true };
}

export async function deleteDealerPriceEntryAction(input: {
  modelId: string;
  priceId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSession();
  } catch {
    return { ok: false, error: "Not authenticated" };
  }
  await deletePriceEntry(OWNER_TENANT_ID, input);
  await logAudit({
    action: "model.price_entry.delete",
    entityType: "model",
    entityId: input.modelId,
    summary: `[Dealer] Deleted price entry ${input.priceId.slice(0, 8)}`,
  });
  revalidatePath("/dealer/models");
  return { ok: true };
}

export async function deleteDealerModelAction(
  modelId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSession();
  } catch {
    return { ok: false, error: "Not authenticated" };
  }
  const m = await getModelById(modelId);
  const result = await deleteModel(modelId);
  if (!result.ok) {
    await logAudit({
      action: "model.delete",
      status: "error",
      entityType: "model",
      entityId: modelId,
      summary: `[Dealer] Refused delete of model "${m?.name ?? modelId}": ${result.reason}`,
    });
    return { ok: false, error: result.reason };
  }
  await logAudit({
    action: "model.delete",
    entityType: "model",
    entityId: modelId,
    summary: `[Dealer] Deleted model "${m?.name ?? modelId}"`,
  });
  revalidatePath("/dealer/models");
  revalidatePath("/dealer/purchases");
  revalidatePath("/dealer/activations");
  return { ok: true };
}

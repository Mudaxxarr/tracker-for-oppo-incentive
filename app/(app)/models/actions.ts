"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
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
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional(),
});

const AddPriceSchema = z.object({
  modelId: z.string().min(1),
  dealerPrice: z.coerce.number().nonnegative(),
  invoicePrice: z.coerce.number().nonnegative(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ModelFormState = { error?: string; ok?: boolean; id?: string };

async function requireAuth(): Promise<boolean> {
  return isAuthenticated();
}

export async function createModelAction(
  _prev: ModelFormState,
  fd: FormData
): Promise<ModelFormState> {
  if (!(await requireAuth())) return { error: "Not authenticated" };
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
    summary: `Added model "${parsed.data.name}" @ ${formatPKR(parsed.data.dealerPrice)} (effective ${parsed.data.effectiveFrom})`,
    payload: parsed.data,
  });
  revalidatePath("/models");
  revalidatePath("/purchases");
  revalidatePath("/activations");
  return { ok: true, id };
}

export async function updateModelAction(
  _prev: ModelFormState,
  fd: FormData
): Promise<ModelFormState> {
  if (!(await requireAuth())) return { error: "Not authenticated" };
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
    summary: `Updated model "${before.name}" → "${parsed.data.name}"`,
    payload: parsed.data,
  });
  revalidatePath("/models");
  revalidatePath("/purchases");
  revalidatePath("/activations");
  return { ok: true };
}

export async function addPriceEntryAction(
  _prev: ModelFormState,
  fd: FormData
): Promise<ModelFormState> {
  if (!(await requireAuth())) return { error: "Not authenticated" };
  const parsed = AddPriceSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const m = await getModelById(parsed.data.modelId);
  if (!m) return { error: "Model not found" };
  const id = await addPriceEntry(OWNER_TENANT_ID, parsed.data);
  await logAudit({
    action: "model.price_entry.add",
    entityType: "model",
    entityId: parsed.data.modelId,
    summary: `Added price for "${m.name}": ${formatPKR(parsed.data.dealerPrice)} dealer / ${formatPKR(parsed.data.invoicePrice)} invoice (from ${parsed.data.effectiveFrom})`,
    payload: { ...parsed.data, priceEntryId: id },
  });
  revalidatePath("/models");
  revalidatePath("/purchases");
  revalidatePath("/activations");
  return { ok: true, id };
}

export async function updatePriceEntryAction(input: {
  modelId: string;
  priceId: string;
  dealerPrice: number;
  invoicePrice: number;
  effectiveFrom: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAuth())) return { ok: false, error: "Not authenticated" };
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
    summary: `Edited price entry for "${m.name}": ${formatPKR(input.dealerPrice)} dealer / ${formatPKR(input.invoicePrice)} invoice (from ${input.effectiveFrom})`,
    payload: input,
  });
  revalidatePath("/models");
  revalidatePath("/purchases");
  revalidatePath("/activations");
  return { ok: true };
}

export async function deletePriceEntryAction(input: {
  modelId: string;
  priceId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAuth())) return { ok: false, error: "Not authenticated" };
  await deletePriceEntry(OWNER_TENANT_ID, input);
  await logAudit({
    action: "model.price_entry.delete",
    entityType: "model",
    entityId: input.modelId,
    summary: `Deleted price entry ${input.priceId.slice(0, 8)}`,
  });
  revalidatePath("/models");
  return { ok: true };
}

export async function deleteModelAction(
  modelId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAuth())) return { ok: false, error: "Not authenticated" };
  const m = await getModelById(modelId);
  const result = await deleteModel(modelId);
  if (!result.ok) {
    await logAudit({
      action: "model.delete",
      status: "error",
      entityType: "model",
      entityId: modelId,
      summary: `Refused delete of model "${m?.name ?? modelId}": ${result.reason}`,
    });
    return { ok: false, error: result.reason };
  }
  await logAudit({
    action: "model.delete",
    entityType: "model",
    entityId: modelId,
    summary: `Deleted model "${m?.name ?? modelId}"`,
  });
  revalidatePath("/models");
  revalidatePath("/purchases");
  revalidatePath("/activations");
  return { ok: true };
}

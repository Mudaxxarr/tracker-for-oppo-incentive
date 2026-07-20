"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { setActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import { createInterIdTransfer, getInterIdTransfer, acceptInterIdTransfer, rejectInterIdTransfer, updateInterIdTransfer, deleteInterIdTransfer } from "@/lib/db/queries/transfers";
import { reEvaluateRebatesForDealer } from "@/lib/db/queries/rebates";
import { getModelById } from "@/lib/db/queries/models";
import { getStockForModelAsOf } from "@/lib/db/queries/purchases";
import { logAudit } from "@/lib/audit";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

const NewIdSchema = z.object({
  name: z.string().trim().min(1).max(120),
  note: z.string().max(500).optional().nullable(),
});

const InterIdSchema = z.object({
  fromDealerId: z.string().min(1),
  toDealerId: z.string().min(1),
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
});

export type IdFormState = { error?: string; ok?: boolean };

export async function createDealerIdAction(
  _prev: IdFormState,
  fd: FormData
): Promise<IdFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = NewIdSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = randomUUID();
  await db.insert(schema.dealerIds).values({
    id,
    tenantId: OWNER_TENANT_ID,
    name: parsed.data.name,
    note: parsed.data.note ?? null,
    isActive: true,
  });
  await setActiveDealerId(id);
  await logAudit({
    action: "dealer.create",
    entityType: "dealer_id",
    entityId: id,
    summary: `Created Dealer ID "${parsed.data.name}" and switched to it`,
    payload: parsed.data,
    dealerId: id,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteDealerIdAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAuthenticated())) return { ok: false, error: "Not authenticated" };

  let targetName: string | undefined;
  try {
    await db.transaction(async () => {
      const [{ n }] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(schema.dealerIds)
        .where(eq(schema.dealerIds.tenantId, OWNER_TENANT_ID));
      if (Number(n) <= 1) throw new Error("Cannot delete the last Dealer ID");
      const [target] = await db
        .select()
        .from(schema.dealerIds)
        .where(eq(schema.dealerIds.id, id))
        .limit(1);
      targetName = target?.name;
      await db.delete(schema.dealerIds).where(eq(schema.dealerIds.id, id));
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed" };
  }

  await logAudit({
    action: "dealer.delete",
    entityType: "dealer_id",
    entityId: id,
    summary: `Deleted Dealer ID "${targetName ?? id}" and its data`,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createInterIdTransferAction(
  _prev: IdFormState,
  fd: FormData
): Promise<IdFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = InterIdSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { fromDealerId, toDealerId, modelId, quantity, transferDate } = parsed.data;
  if (fromDealerId === toDealerId) return { error: "Source and destination must be different" };

  try {
    let stockError: string | null = null;
    let id: string | undefined;
    await db.transaction(async (tx) => {
      const stock = await getStockForModelAsOf(OWNER_TENANT_ID, fromDealerId, modelId, transferDate, tx);
      if (stock < quantity) {
        stockError = `Only ${stock} unit(s) available in source ID as of ${transferDate}`;
        return;
      }
      id = await createInterIdTransfer({
        tenantId: OWNER_TENANT_ID,
        fromDealerId: parsed.data.fromDealerId,
        toDealerId: parsed.data.toDealerId,
        modelId: parsed.data.modelId,
        quantity: parsed.data.quantity,
        transferDate: parsed.data.transferDate,
        note: parsed.data.note ?? null,
      }, tx);
    });
    if (stockError) return { error: stockError };
    if (!id) return { error: "Transfer failed" };
    const m = await getModelById(parsed.data.modelId);
    const [src, dst] = await Promise.all([
      db.select().from(schema.dealerIds).where(eq(schema.dealerIds.id, parsed.data.fromDealerId)).limit(1),
      db.select().from(schema.dealerIds).where(eq(schema.dealerIds.id, parsed.data.toDealerId)).limit(1),
    ]);
    await logAudit({
      action: "inter_id.transfer",
      entityType: "inter_id_transfer",
      entityId: id,
      summary: `Inter-ID: ${parsed.data.quantity} × ${m?.name ?? "?"} from ${src[0]?.name ?? "?"} → ${dst[0]?.name ?? "?"}`,
      payload: parsed.data,
    });
    revalidatePath("/ids");
    revalidatePath("/purchases");
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, fromDealerId, modelId, transferDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transfer failed";
    await logAudit({
      action: "inter_id.transfer",
      status: "error",
      summary: `Inter-ID transfer failed: ${msg}`,
    });
    return { error: msg };
  }
}

const EditTransferSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function acceptInterIdTransferAction(id: string): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const t = await getInterIdTransfer(id, OWNER_TENANT_ID);
  if (!t) return { error: "Transfer not found" };
  const res = await acceptInterIdTransfer(OWNER_TENANT_ID, id, t.toDealerId, OWNER_TENANT_ID);
  if (!res.ok) return { error: res.message };
  await logAudit({ action: "inter_id.accept", entityType: "inter_id_transfer", entityId: id, summary: `Accepted inter-ID transfer ${id.slice(0, 8)}` });
  revalidatePath("/ids"); revalidatePath("/purchases"); revalidatePath("/dashboard");
  await reEvaluateRebatesForDealer(OWNER_TENANT_ID, t.toDealerId, t.modelId, t.transferDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return {};
}

export async function rejectInterIdTransferAction(id: string): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const t = await getInterIdTransfer(id, OWNER_TENANT_ID);
  if (!t) return { error: "Transfer not found" };
  const res = await rejectInterIdTransfer(OWNER_TENANT_ID, id, t.toDealerId);
  if (!res.ok) return { error: res.message };
  await logAudit({ action: "inter_id.reject", entityType: "inter_id_transfer", entityId: id, summary: `Rejected inter-ID transfer ${id.slice(0, 8)}` });
  revalidatePath("/ids"); revalidatePath("/purchases"); revalidatePath("/dashboard");
  // Reject returns the reserved stock to the source → re-evaluate source rebates.
  await reEvaluateRebatesForDealer(OWNER_TENANT_ID, t.fromDealerId, t.modelId, t.transferDate).catch((e: unknown) => console.error("[rebate-reeval]", e));
  return {};
}

export async function updateInterIdTransferAction(id: string, input: { quantity: number; transferDate: string }): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = EditTransferSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const res = await updateInterIdTransfer(id, OWNER_TENANT_ID, parsed.data, OWNER_TENANT_ID);
  if (!res.ok) return { error: res.message };
  await logAudit({ action: "inter_id.update", entityType: "inter_id_transfer", entityId: id, summary: `Edited inter-ID transfer ${id.slice(0, 8)}: qty ${parsed.data.quantity}, ${parsed.data.transferDate}` });
  revalidatePath("/ids"); revalidatePath("/purchases"); revalidatePath("/dashboard");
  for (const dealerId of [res.fromDealerId!, res.toDealerId!]) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, res.modelId!, res.earliestDate!).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
  return {};
}

export async function deleteInterIdTransferAction(id: string): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const res = await deleteInterIdTransfer(id, OWNER_TENANT_ID);
  if (!res.ok) return { error: res.message };
  await logAudit({ action: "inter_id.delete", entityType: "inter_id_transfer", entityId: id, summary: `Deleted inter-ID transfer ${id.slice(0, 8)}` });
  revalidatePath("/ids"); revalidatePath("/purchases"); revalidatePath("/dashboard");
  for (const dealerId of [res.fromDealerId!, res.toDealerId!]) {
    await reEvaluateRebatesForDealer(OWNER_TENANT_ID, dealerId, res.modelId!, res.earliestDate!).catch((e: unknown) => console.error("[rebate-reeval]", e));
  }
  return {};
}

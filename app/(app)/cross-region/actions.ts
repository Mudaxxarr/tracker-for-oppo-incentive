"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated, isAnyAuthenticated } from "@/lib/auth";
import { getActiveDealerId, OWNER_TENANT_ID } from "@/lib/dealer";
import {
  createCrossRegion,
  deleteCrossRegion,
  updateCrossRegionStatus,
} from "@/lib/db/queries/transfers";
import { getModelById } from "@/lib/db/queries/models";
import { createOwnerAlert } from "@/lib/db/queries/alerts";
import { CROSS_REGION_STATUS, OWNER_ALERT_TYPE } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

const Schema = z.object({
  modelId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  reportedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceRegionNote: z.string().max(500).optional().nullable(),
});

export type CrFormState = { error?: string; ok?: boolean };

export async function createCrossRegionAction(
  _prev: CrFormState,
  fd: FormData
): Promise<CrFormState> {
  if (!(await isAnyAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;
  const parsed = Schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const isOwner = await isAuthenticated();
  const id = await createCrossRegion({
    tenantId,
    dealerId,
    ...parsed.data,
    sourceRegionNote: parsed.data.sourceRegionNote ?? null,
    // SO-created transfers go straight to pending owner approval
    initialStatus: isOwner ? CROSS_REGION_STATUS.PENDING_REPORT : CROSS_REGION_STATUS.PENDING_OWNER_APPROVAL,
  });
  const m = await getModelById(parsed.data.modelId);

  if (!isOwner) {
    await createOwnerAlert({
      tenantId,
      type: OWNER_ALERT_TYPE.CR_PENDING_APPROVAL,
      entityType: "cross_region_transfer",
      entityId: id,
      dealerId,
      message: `SO reported cross-region transfer: ${parsed.data.quantity} × ${m?.name ?? "?"} — awaiting your approval.`,
    });
  }

  await logAudit({
    action: "cross_region.create",
    entityType: "cross_region_transfer",
    entityId: id,
    summary: `Reported cross-region: ${parsed.data.quantity} × ${m?.name ?? "?"}${
      parsed.data.sourceRegionNote ? ` from ${parsed.data.sourceRegionNote}` : ""
    }`,
    payload: parsed.data,
  });
  revalidatePath("/cross-region");
  revalidatePath("/dashboard");
  return { ok: true };
}

// CR-1: owner approves or rejects a pending cross-region transfer
export async function updateStatusAction(
  id: string,
  status: "PENDING_REPORT" | "PENDING_OWNER_APPROVAL" | "SHIFTED_TO_MY_ID" | "REJECTED"
): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAuthenticated())) return { ok: false, message: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { ok: false, message: "No active Dealer ID" };
  const result = await updateCrossRegionStatus({ id, tenantId: OWNER_TENANT_ID, dealerId, status, priceTenantId: OWNER_TENANT_ID });
  await logAudit({
    action: "cross_region.status",
    entityType: "cross_region_transfer",
    entityId: id,
    status: result.ok ? "ok" : "error",
    summary: result.ok
      ? `Cross-region ${id.slice(0, 8)} → ${status}${result.created ? ` (created ${result.created} purchase line)` : ""}`
      : `Cross-region status update failed: ${result.message}`,
    payload: { status, created: result.created },
  });
  revalidatePath("/cross-region");
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: result.ok, message: result.message };
}

const EditSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  reportedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceRegionNote: z.string().max(500).optional().nullable(),
});

export async function editCrossRegionAction(
  _prev: CrFormState,
  fd: FormData
): Promise<CrFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerId();
  if (!dealerId) return { error: "No active Dealer ID" };
  const tenantId = OWNER_TENANT_ID;
  const parsed = EditSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { db, schema } = await import("@/lib/db/client");
  const { and, eq } = await import("drizzle-orm");
  const { CROSS_REGION_STATUS } = await import("@/lib/constants");

  // Only allow editing PENDING rows
  const rows = await db
    .select()
    .from(schema.crossRegionTransfers)
    .where(and(eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.id, parsed.data.id), eq(schema.crossRegionTransfers.dealerId, dealerId)))
    .limit(1);
  if (rows.length === 0) return { error: "Not found" };
  if (rows[0].status !== CROSS_REGION_STATUS.PENDING_REPORT) {
    return { error: "Only pending transfers can be edited" };
  }

  await db
    .update(schema.crossRegionTransfers)
    .set({
      quantity: parsed.data.quantity,
      reportedDate: parsed.data.reportedDate,
      sourceRegionNote: parsed.data.sourceRegionNote ?? null,
    })
    .where(and(eq(schema.crossRegionTransfers.tenantId, tenantId), eq(schema.crossRegionTransfers.id, parsed.data.id)));

  await logAudit({
    action: "cross_region.edit",
    entityType: "cross_region_transfer",
    entityId: parsed.data.id,
    summary: `Edited cross-region ${parsed.data.id.slice(0, 8)}: qty=${parsed.data.quantity}`,
    payload: parsed.data,
  });
  revalidatePath("/cross-region");
  return { ok: true };
}

export async function deleteCrossRegionAction(id: string): Promise<void> {
  if (!(await isAuthenticated())) return;
  const dealerId = await getActiveDealerId();
  if (!dealerId) return;
  await deleteCrossRegion(id, OWNER_TENANT_ID, dealerId);
  await logAudit({
    action: "cross_region.delete",
    entityType: "cross_region_transfer",
    entityId: id,
    summary: `Deleted cross-region ${id.slice(0, 8)} and its linked purchases`,
  });
  revalidatePath("/cross-region");
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
}

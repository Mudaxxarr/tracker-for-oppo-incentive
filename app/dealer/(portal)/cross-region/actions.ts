"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { createCrossRegion, submitCrossRegionForApproval, deleteCrossRegion } from "@/lib/db/queries/transfers";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { logAudit } from "@/lib/audit";
import { createOwnerAlert } from "@/lib/db/queries/alerts";
import { OWNER_ALERT_TYPE } from "@/lib/constants";

export type CrossRegionFormState = { error?: string; ok?: boolean };

const CreateSchema = z.object({
  modelId: z.string().min(1, "Choose a model"),
  quantity: z.coerce.number().int().positive("Quantity must be ≥ 1"),
  reportedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  sourceRegionNote: z.string().max(300).optional().nullable(),
});

const EditSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be ≥ 1"),
  reportedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  sourceRegionNote: z.string().max(300).optional().nullable(),
});

export async function createCrossRegionAction(
  _prev: CrossRegionFormState,
  formData: FormData,
): Promise<CrossRegionFormState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };

  const parsed = CreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { modelId, quantity, reportedDate, sourceRegionNote } = parsed.data;
  try {
    const id = await createCrossRegion({
      tenantId: session.tenantId,
      dealerId,
      modelId,
      quantity,
      reportedDate,
      sourceRegionNote: sourceRegionNote ?? null,
    });
    await logAudit({
      action: "cross_region.create",
      dealerId,
      entityType: "cross_region_transfer",
      entityId: id,
      summary: `[Dealer] Created cross-region: qty ${quantity} on ${reportedDate}`,
    });
    revalidatePath("/dealer/cross-region");
    revalidatePath("/dealer/dashboard");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return { error: msg };
  }
}

export async function editDealerCrossRegionAction(
  _prev: CrossRegionFormState,
  fd: FormData,
): Promise<CrossRegionFormState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };

  const parsed = EditSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { db, schema } = await import("@/lib/db/client");
  const { and, eq } = await import("drizzle-orm");
  const { CROSS_REGION_STATUS } = await import("@/lib/constants");

  const rows = await db
    .select()
    .from(schema.crossRegionTransfers)
    .where(
      and(
        eq(schema.crossRegionTransfers.tenantId, session.tenantId),
        eq(schema.crossRegionTransfers.id, parsed.data.id),
        eq(schema.crossRegionTransfers.dealerId, dealerId),
      ),
    )
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
    .where(
      and(
        eq(schema.crossRegionTransfers.tenantId, session.tenantId),
        eq(schema.crossRegionTransfers.id, parsed.data.id),
      ),
    );

  await logAudit({
    action: "cross_region.edit",
    dealerId,
    entityType: "cross_region_transfer",
    entityId: parsed.data.id,
    summary: `[Dealer] Edited cross-region ${parsed.data.id.slice(0, 8)}: qty=${parsed.data.quantity}`,
  });
  revalidatePath("/dealer/cross-region");
  return { ok: true };
}

export async function submitCrossRegionForApprovalAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const session = await getDealerSession();
  if (!session) return { ok: false, message: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { ok: false, message: "No active Dealer ID" };

  // Dealer ADMIN is the main account owner of the ID — can self-approve without waiting for owner
  if (session.role === "admin") {
    const { db, schema } = await import("@/lib/db/client");
    const { and, eq } = await import("drizzle-orm");
    const { CROSS_REGION_STATUS: CRS } = await import("@/lib/constants");
    const today = new Date().toISOString().slice(0, 10);

    const rows = await db
      .select({ status: schema.crossRegionTransfers.status })
      .from(schema.crossRegionTransfers)
      .where(and(
        eq(schema.crossRegionTransfers.id, id),
        eq(schema.crossRegionTransfers.tenantId, session.tenantId),
        eq(schema.crossRegionTransfers.dealerId, dealerId),
      ))
      .limit(1);

    if (rows.length === 0) return { ok: false, message: "Transfer not found" };
    if (rows[0].status === CRS.REJECTED) return { ok: false, message: "Rejected transfers cannot be approved" };
    if (rows[0].status === CRS.SHIFTED_TO_MY_ID) return { ok: false, message: "Already approved" };

    await db
      .update(schema.crossRegionTransfers)
      .set({ status: CRS.SHIFTED_TO_MY_ID, shiftedToIdDate: today })
      .where(eq(schema.crossRegionTransfers.id, id));

    await logAudit({
      action: "cross_region.self_approved",
      dealerId,
      entityType: "cross_region_transfer",
      entityId: id,
      summary: `[Dealer Admin] Self-approved CR transfer ${id.slice(0, 8)} — stock shifted to ID`,
    });
    revalidatePath("/dealer/cross-region");
    revalidatePath("/dealer/dashboard");
    return { ok: true };
  }

  // Exec role: must submit for owner approval
  const result = await submitCrossRegionForApproval({ id, tenantId: session.tenantId, dealerId });
  if (result.ok) {
    await createOwnerAlert({
      tenantId: session.tenantId,
      type: OWNER_ALERT_TYPE.CR_PENDING_APPROVAL,
      entityType: "cross_region_transfer",
      entityId: id,
      dealerId,
      message: `[HIGH ALERT] Cross-region transfer submitted for approval — dealer is waiting for stock to be approved`,
    });
    await logAudit({
      action: "cross_region.submit_for_approval",
      dealerId,
      entityType: "cross_region_transfer",
      entityId: id,
      summary: `[Dealer Exec] CR ${id.slice(0, 8)} submitted for owner approval`,
    });
    revalidatePath("/dealer/cross-region");
    revalidatePath("/dealer/dashboard");
  }
  return result;
}

export async function deleteDealerCrossRegionAction(id: string): Promise<void> {
  const session = await getDealerSession();
  if (!session) return;
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return;
  await deleteCrossRegion(id, session.tenantId, dealerId);
  await logAudit({
    action: "cross_region.delete",
    dealerId,
    summary: `[Dealer] CR deleted: ${id.slice(0, 8)}`,
  });
  revalidatePath("/dealer/cross-region");
  revalidatePath("/dealer/dashboard");
}

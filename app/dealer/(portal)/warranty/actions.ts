"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import {
  createWarrantyClaim,
  updateWarrantyClaimStatus,
} from "@/lib/db/queries/warranty-claims";
import { logAudit } from "@/lib/audit";

export type WarrantyFormState = { error?: string; ok?: boolean };

const CreateSchema = z.object({
  modelId: z.string().min(1, "Model required"),
  issueDesc: z.string().trim().min(5, "Describe the issue (min 5 chars)").max(500),
  customerId: z.string().optional().nullable(),
});

export async function createDealerWarrantyClaimAction(
  _prev: WarrantyFormState,
  fd: FormData
): Promise<WarrantyFormState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };

  const parsed = CreateSchema.safeParse({
    modelId: fd.get("modelId"),
    issueDesc: fd.get("issueDesc"),
    customerId: fd.get("customerId") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = await createWarrantyClaim({
    tenantId: session.tenantId,
    dealerId,
    modelId: parsed.data.modelId,
    issueDesc: parsed.data.issueDesc,
    customerId: parsed.data.customerId ?? null,
  });

  await logAudit({
    action: "warranty.create",
    entityType: "warranty_claim",
    entityId: id,
    dealerId,
    summary: `[Dealer] Logged warranty claim for model ${parsed.data.modelId}`,
  });
  revalidatePath("/dealer/warranty");
  return { ok: true };
}

export async function updateDealerWarrantyStatusAction(
  id: string,
  status: string
): Promise<{ error?: string }> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return { error: "No active Dealer ID" };

  const allowed = ["in_repair", "resolved", "rejected"];
  if (!allowed.includes(status)) return { error: "Invalid status" };

  await updateWarrantyClaimStatus(id, status, session.tenantId);
  await logAudit({
    action: "warranty.update_status",
    entityType: "warranty_claim",
    entityId: id,
    dealerId,
    summary: `[Dealer] Updated warranty claim status to ${status}`,
  });
  revalidatePath("/dealer/warranty");
  return {};
}

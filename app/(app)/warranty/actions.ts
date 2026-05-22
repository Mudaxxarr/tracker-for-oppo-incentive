"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { updateWarrantyClaimStatus } from "@/lib/db/queries/warranty-claims";
import { logAudit } from "@/lib/audit";

export async function updateWarrantyStatusAction(
  id: string,
  status: string
): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };

  const allowed = ["pending", "in_repair", "resolved", "rejected"];
  if (!allowed.includes(status)) return { error: "Invalid status" };

  await updateWarrantyClaimStatus(id, status, OWNER_TENANT_ID);
  await logAudit({
    action: "warranty.update_status",
    entityType: "warranty_claim",
    entityId: id,
    summary: `[Owner] Updated warranty claim status to ${status}`,
  });
  revalidatePath("/warranty");
  return {};
}

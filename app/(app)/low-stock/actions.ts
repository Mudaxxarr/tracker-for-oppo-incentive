"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { setModelLowStockThreshold } from "@/lib/db/queries/models";
import { logAudit } from "@/lib/audit";

export async function setThresholdAction(
  modelId: string,
  threshold: number | null
): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  if (threshold !== null && (threshold < 0 || threshold > 9999)) return { error: "Threshold must be 0–9999" };
  await setModelLowStockThreshold(modelId, threshold);
  await logAudit({
    action: "model.set_threshold",
    entityType: "model",
    entityId: modelId,
    summary: `Set low-stock threshold to ${threshold ?? "none"} for model ${modelId}`,
  });
  revalidatePath("/low-stock");
  return {};
}

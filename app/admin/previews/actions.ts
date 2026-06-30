"use server";

import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { bulkGrantTrial, bulkRevokeTrial, markPreviewPurchased, listTenantFeatureMatrix } from "@/lib/admin/dealers";
import { PREVIEW_CATALOG, type PreviewKey } from "@/lib/dealer-previews";
import { buildTrialEntry } from "@/lib/dealer-trials";
import { markAlertRead } from "@/lib/db/queries/alerts";

export async function broadcastAction(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  const key = formData.get("key") as PreviewKey;
  const act = formData.get("action") as "grant" | "revoke";
  const preview = PREVIEW_CATALOG.find((p) => p.key === key);
  if (!preview) throw new Error("Unknown feature");

  const tenants = await listTenantFeatureMatrix();
  const ids = tenants.filter((t) => t.status !== "suspended").map((t) => t.id);

  if (act === "grant") {
    await bulkGrantTrial(key, buildTrialEntry(preview.trialDays), ids);
  } else {
    await bulkRevokeTrial(key, ids);
  }

  redirect("/admin/previews");
}

export async function approvePurchaseAction(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  const tenantId = formData.get("tenantId") as string;
  const key = formData.get("key") as PreviewKey;
  const alertId = formData.get("alertId") as string;
  if (!tenantId || !key) throw new Error("Missing fields");

  await markPreviewPurchased(tenantId, key);
  if (alertId) await markAlertRead(alertId);

  redirect("/admin/previews");
}

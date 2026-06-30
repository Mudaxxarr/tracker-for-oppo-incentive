"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { bulkSetFeature, bulkGrantTrial, bulkRevokeTrial, listTenantFeatureMatrix } from "@/lib/admin/dealers";
import { ALL_FEATURE_KEYS } from "@/lib/dealer-features";
import { DEALER_ADDONS } from "@/lib/dealer-addons";
import { PREVIEW_CATALOG, type PreviewKey } from "@/lib/dealer-previews";
import { buildTrialEntry } from "@/lib/dealer-trials";

export type RolloutActionState = { error?: string };

const VALID_KEYS = new Set<string>([
  ...ALL_FEATURE_KEYS,
  ...DEALER_ADDONS.map((a) => a.key),
]);

const RolloutSchema = z.object({
  featureKey: z.string().min(1),
  enable: z.enum(["true", "false"]),
  scope: z.enum(["one", "all"]),
  tenantId: z.string().optional(),
});

export async function setFeatureRolloutAction(
  _prev: RolloutActionState,
  fd: FormData,
): Promise<RolloutActionState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = RolloutSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Invalid input" };

  const { featureKey, enable, scope, tenantId } = parsed.data;
  if (!VALID_KEYS.has(featureKey)) return { error: "Unknown feature" };

  if (scope === "one") {
    if (!tenantId) return { error: "Pick a canary tenant first" };
    await bulkSetFeature(featureKey, enable === "true", [tenantId]);
  } else {
    const tenants = await listTenantFeatureMatrix();
    const ids = tenants.filter((t) => t.status !== "suspended").map((t) => t.id);
    await bulkSetFeature(featureKey, enable === "true", ids);
  }

  redirect("/admin/rollout");
}

export type BroadcastTrialState = { error?: string };

const BroadcastSchema = z.object({
  previewKey: z.string().min(1),
  action: z.enum(["grant", "revoke"]),
});

export async function broadcastTrialAction(
  _prev: BroadcastTrialState,
  fd: FormData,
): Promise<BroadcastTrialState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = BroadcastSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Invalid input" };

  const { previewKey, action } = parsed.data;
  const preview = PREVIEW_CATALOG.find((p) => p.key === previewKey);
  if (!preview) return { error: "Unknown feature" };

  const tenants = await listTenantFeatureMatrix();
  const ids = tenants.filter((t) => t.status !== "suspended").map((t) => t.id);

  if (action === "grant") {
    await bulkGrantTrial(previewKey as PreviewKey, buildTrialEntry(preview.trialDays), ids);
  } else {
    await bulkRevokeTrial(previewKey as PreviewKey, ids);
  }

  redirect("/admin/rollout");
}

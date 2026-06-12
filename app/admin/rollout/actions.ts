"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { bulkSetFeature, listTenantFeatureMatrix } from "@/lib/admin/dealers";
import { ALL_FEATURE_KEYS } from "@/lib/dealer-features";
import { DEALER_ADDONS } from "@/lib/dealer-addons";

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

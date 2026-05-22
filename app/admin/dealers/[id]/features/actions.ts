"use server";

import { updateDealerFeatures } from "@/lib/admin/dealers";
import { isAuthenticated } from "@/lib/auth";
import { ALL_FEATURE_KEYS, type DealerFeatureKey } from "@/lib/dealer-features";
import { redirect } from "next/navigation";

export async function saveFeaturesAction(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  const tenantId = formData.get("tenantId");
  if (typeof tenantId !== "string" || !tenantId) {
    throw new Error("Missing tenant ID");
  }

  const features: Partial<Record<DealerFeatureKey, boolean>> = {};
  for (const key of ALL_FEATURE_KEYS) {
    features[key] = formData.get(key) === "on";
  }

  try {
    await updateDealerFeatures(tenantId, features);
  } catch (err) {
    throw new Error("Failed to save feature flags", { cause: err });
  }

  redirect(`/admin/dealers/${tenantId}`);
}

export async function enableAllFeaturesAction(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  const tenantId = formData.get("tenantId");
  if (typeof tenantId !== "string" || !tenantId) {
    throw new Error("Missing tenant ID");
  }

  const all: Partial<Record<DealerFeatureKey, boolean>> = {};
  for (const key of ALL_FEATURE_KEYS) {
    all[key] = true;
  }

  await updateDealerFeatures(tenantId, all);
  redirect(`/admin/dealers/${tenantId}/features`);
}

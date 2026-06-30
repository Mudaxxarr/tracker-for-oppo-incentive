"use server";

import {
  updateDealerFeatures,
  getRawTenantFeatures,
  grantPreviewTrial,
  markPreviewPurchased,
  getTenantTrialsById,
} from "@/lib/admin/dealers";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { serializeFeatureTrials } from "@/lib/dealer-trials";
import { isAuthenticated } from "@/lib/auth";
import { ALL_REGISTRY_NODES, getRegistryNode } from "@/lib/feature-registry";
import { buildTrialEntry } from "@/lib/dealer-trials";
import type { PreviewKey } from "@/lib/dealer-previews";
import { redirect } from "next/navigation";

function requireTenantId(formData: FormData): string {
  const id = formData.get("tenantId");
  if (typeof id !== "string" || !id) throw new Error("Missing tenant ID");
  return id;
}

// Save every registry node's toggle. Merge onto RAW stored flags so unrelated
// keys (and any not in the registry) are preserved.
export async function saveFeaturesAction(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  const tenantId = requireTenantId(formData);

  const features = await getRawTenantFeatures(tenantId);
  const flags = features as Record<string, boolean>;

  for (const node of ALL_REGISTRY_NODES) {
    const checked = formData.get(node.key) === "on";
    if (node.defaultOn) {
      // Included: store explicit false to disable; true when on.
      flags[node.key] = checked;
    } else {
      // Upsell: true when on, otherwise remove the key (clean JSON).
      if (checked) flags[node.key] = true;
      else delete flags[node.key];
    }
  }

  try {
    await updateDealerFeatures(tenantId, features);
  } catch (err) {
    throw new Error("Failed to save feature flags", { cause: err });
  }
  redirect(`/admin/dealers/${tenantId}/features`);
}

export async function enableAllFeaturesAction(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  const tenantId = requireTenantId(formData);

  const features = await getRawTenantFeatures(tenantId);
  const flags = features as Record<string, boolean>;
  for (const node of ALL_REGISTRY_NODES) flags[node.key] = true;

  await updateDealerFeatures(tenantId, features);
  redirect(`/admin/dealers/${tenantId}/features`);
}

export async function grantTrialAction(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  const tenantId = requireTenantId(formData);
  const key = formData.get("key") as string;
  const node = getRegistryNode(key);
  if (!node) throw new Error("Unknown feature");
  await grantPreviewTrial(tenantId, key as PreviewKey, buildTrialEntry(node.trialDays));
  redirect(`/admin/dealers/${tenantId}/features`);
}

export async function revokeTrialAction(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  const tenantId = requireTenantId(formData);
  const key = formData.get("key") as string;
  if (!key) throw new Error("Missing key");

  const trials = await getTenantTrialsById(tenantId);
  delete trials[key as keyof typeof trials];
  await db
    .update(schema.dealerTenants)
    .set({ featureTrials: serializeFeatureTrials(trials) })
    .where(eq(schema.dealerTenants.id, tenantId));
  redirect(`/admin/dealers/${tenantId}/features`);
}

export async function markPurchasedAction(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
  const tenantId = requireTenantId(formData);
  const key = formData.get("key") as string;
  if (!key) throw new Error("Missing key");
  await markPreviewPurchased(tenantId, key as PreviewKey);
  redirect(`/admin/dealers/${tenantId}/features`);
}

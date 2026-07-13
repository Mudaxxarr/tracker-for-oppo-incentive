"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isAuthenticated } from "@/lib/auth";
import {
  getRawTenantFeatures,
  updateDealerFeatures,
  updateDealerSettings,
} from "@/lib/admin/dealers";
import { mergeManagerFeatureFlags } from "@/lib/admin/manager";
import { ALL_REGISTRY_NODES } from "@/lib/feature-registry";

const SettingsSchema = z.object({
  tenantId: z.string().min(1),
  backdateDays: z.coerce.number().int().min(0).max(30),
  purchaseApprovalThreshold: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.coerce.number().int().min(0).nullable(),
  ),
});

function tenantIdFrom(formData: FormData): string {
  const tenantId = formData.get("tenantId");
  if (typeof tenantId !== "string" || !tenantId) throw new Error("Missing tenant ID");
  return tenantId;
}

async function requireOwner(): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");
}

export async function saveManagerSettingsAction(formData: FormData): Promise<void> {
  await requireOwner();
  const parsed = SettingsSchema.safeParse(Object.fromEntries(formData));
  const tenantId = tenantIdFrom(formData);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid settings";
    redirect(`/manager/${encodeURIComponent(tenantId)}?error=${encodeURIComponent(message)}`);
  }

  await updateDealerSettings(parsed.data.tenantId, {
    backdateDays: parsed.data.backdateDays,
    purchaseApprovalThreshold: parsed.data.purchaseApprovalThreshold,
  });
  redirect(`/manager/${encodeURIComponent(tenantId)}?saved=settings`);
}

export async function saveManagerFeaturesAction(formData: FormData): Promise<void> {
  await requireOwner();
  const tenantId = tenantIdFrom(formData);
  const existing = await getRawTenantFeatures(tenantId);
  const enabledKeys = new Set(
    ALL_REGISTRY_NODES
      .filter((node) => formData.get(node.key) === "on")
      .map((node) => node.key),
  );

  await updateDealerFeatures(
    tenantId,
    mergeManagerFeatureFlags(existing, enabledKeys),
  );
  redirect(`/manager/${encodeURIComponent(tenantId)}?saved=features`);
}

export async function enableAllManagerFeaturesAction(formData: FormData): Promise<void> {
  await requireOwner();
  const tenantId = tenantIdFrom(formData);
  const existing = await getRawTenantFeatures(tenantId);
  await updateDealerFeatures(
    tenantId,
    mergeManagerFeatureFlags(
      existing,
      new Set(ALL_REGISTRY_NODES.map((node) => node.key)),
    ),
  );
  redirect(`/manager/${encodeURIComponent(tenantId)}?saved=features`);
}

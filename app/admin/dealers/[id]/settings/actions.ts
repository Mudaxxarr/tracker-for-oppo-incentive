"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { updateDealerSettings } from "@/lib/admin/dealers";

const Schema = z.object({
  tenantId: z.string().min(1),
  backdateDays: z.coerce.number().int().min(0).max(30),
  purchaseApprovalThreshold: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.coerce.number().int().min(0).nullable(),
  ),
});

export async function saveDealerSettingsAction(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Not authenticated");

  const parsed = Schema.safeParse(Object.fromEntries(formData));
  const tenantId = formData.get("tenantId") as string;

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/admin/dealers/${tenantId}/settings?error=${encodeURIComponent(msg)}`);
  }

  await updateDealerSettings(parsed.data.tenantId, {
    backdateDays: parsed.data.backdateDays,
    purchaseApprovalThreshold: parsed.data.purchaseApprovalThreshold,
  });

  redirect(`/admin/dealers/${tenantId}`);
}

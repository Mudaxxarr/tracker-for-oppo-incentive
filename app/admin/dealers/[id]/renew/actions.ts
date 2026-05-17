"use server";

import { redirect } from "next/navigation";
import { renewTenant } from "@/lib/admin/dealers";
import { z } from "zod";

const Schema = z.object({
  months: z.coerce.number().int().min(1).max(60),
  tenantId: z.string().min(1),
});

export type RenewState = { error?: string };

export async function renewTenantAction(
  _prev: RenewState,
  formData: FormData,
): Promise<RenewState> {
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { tenantId, months } = parsed.data;

  try {
    await renewTenant(tenantId, months);
  } catch (err) {
    throw new Error("Failed to renew subscription", { cause: err });
  }

  redirect(`/admin/dealers/${tenantId}`);
}

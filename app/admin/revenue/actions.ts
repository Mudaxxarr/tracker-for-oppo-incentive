"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

const FeeSchema = z.coerce.number().min(0).max(9999999).nullable();

export async function setDealerMonthlyFeeAction(
  tenantId: string,
  value: string
): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = FeeSchema.safeParse(value === "" ? null : value);
  if (!parsed.success) return { error: "Invalid fee amount" };
  await db
    .update(schema.dealerTenants)
    .set({ monthlyFee: parsed.data })
    .where(eq(schema.dealerTenants.id, tenantId));
  await logAudit({
    action: "admin.set_monthly_fee",
    entityType: "dealer_tenant",
    entityId: tenantId,
    summary: `Set monthly fee to ${parsed.data ?? "unset"} for tenant ${tenantId}`,
  });
  revalidatePath("/admin/revenue");
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getDealerSession } from "@/lib/dealer-auth";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { purgeAuditLog } from "@/lib/audit";
import { listDealerIdsForTenant } from "@/lib/dealer-tenant";

export type SettingsState = { ok?: boolean; error?: string };

export async function changeDealerPasswordAction(
  _prev: SettingsState,
  fd: FormData,
): Promise<SettingsState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };

  const currentPassword = String(fd.get("currentPassword") ?? "");
  const newPassword = String(fd.get("newPassword") ?? "");
  const confirmPassword = String(fd.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) return { error: "All fields are required" };
  if (newPassword.length < 6) return { error: "New password must be at least 6 characters" };
  if (newPassword !== confirmPassword) return { error: "Passwords do not match" };

  const rows = await db
    .select({ id: schema.dealerUsers.id, hash: schema.dealerUsers.passwordHash })
    .from(schema.dealerUsers)
    .where(eq(schema.dealerUsers.id, session.userId))
    .limit(1);

  if (rows.length === 0) return { error: "User not found" };
  const ok = await bcrypt.compare(currentPassword, rows[0].hash);
  if (!ok) return { error: "Current password is incorrect" };

  const newHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(schema.dealerUsers)
    .set({ passwordHash: newHash })
    .where(eq(schema.dealerUsers.id, session.userId));

  return { ok: true };
}

export async function purgeDealerAuditLogAction(olderThanDays: number): Promise<{ ok?: boolean; deleted?: number; error?: string }> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  const dealerRows = await listDealerIdsForTenant(session.tenantId);
  const dealerIds = dealerRows.map((d) => d.id);
  if (dealerIds.length === 0) return { ok: true, deleted: 0 };
  const deleted = await purgeAuditLog(olderThanDays, dealerIds);
  revalidatePath("/dealer/activity");
  return { ok: true, deleted };
}

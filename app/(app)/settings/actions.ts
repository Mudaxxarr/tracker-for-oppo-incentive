"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPin, isAuthenticated, setPinHash, verifyPin, setTeamPinHash } from "@/lib/auth";
import { setConstants } from "@/lib/settings";
import { logAudit, purgeAuditLog } from "@/lib/audit";

const PinSchema = z.object({
  currentPin: z.string().min(4).max(12),
  newPin: z.string().min(4).max(12),
  confirmPin: z.string().min(4).max(12),
});

const ConstSchema = z.object({
  basePercent: z.coerce.number().nonnegative().max(100),
  defaultBonusPercent: z.coerce.number().nonnegative().max(100),
});

export type SettingsFormState = { error?: string; ok?: boolean };

export async function changePinAction(
  _prev: SettingsFormState,
  fd: FormData
): Promise<SettingsFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = PinSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.newPin !== parsed.data.confirmPin) {
    return { error: "New PIN and confirmation do not match" };
  }
  if (!(await verifyPin(parsed.data.currentPin))) {
    return { error: "Current PIN is incorrect" };
  }
  if (!/^\d+$/.test(parsed.data.newPin)) {
    return { error: "PIN must contain digits only" };
  }
  await setPinHash(await hashPin(parsed.data.newPin));
  await logAudit({ action: "auth.pin_change", summary: "PIN changed" });
  return { ok: true };
}

export async function updateConstantsAction(
  _prev: SettingsFormState,
  fd: FormData
): Promise<SettingsFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = ConstSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await setConstants(parsed.data);
  await logAudit({
    action: "settings.constants_update",
    summary: `Updated constants: base ${parsed.data.basePercent}%, default bonus ${parsed.data.defaultBonusPercent}%`,
    payload: parsed.data,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const TeamPinSchema = z.object({
  newTeamPin: z.string().min(4).max(12),
  confirmTeamPin: z.string().min(4).max(12),
});

export async function setTeamPinAction(
  _prev: SettingsFormState,
  fd: FormData
): Promise<SettingsFormState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = TeamPinSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.newTeamPin !== parsed.data.confirmTeamPin) {
    return { error: "Team PIN and confirmation do not match" };
  }
  if (!/^\d+$/.test(parsed.data.newTeamPin)) {
    return { error: "PIN must contain digits only" };
  }
  await setTeamPinHash(await hashPin(parsed.data.newTeamPin));
  await logAudit({ action: "auth.team_pin_set", summary: "Team PIN set/updated" });
  return { ok: true };
}

export async function purgeAuditLogAction(
  olderThanDays: number
): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  if (!(await isAuthenticated())) return { ok: false, error: "Not authenticated" };
  if (!Number.isFinite(olderThanDays) || olderThanDays < 1)
    return { ok: false, error: "Provide a positive day count" };
  const deleted = await purgeAuditLog(Math.floor(olderThanDays));
  await logAudit({
    action: "audit.purge",
    summary: `Purged ${deleted} audit-log entries older than ${olderThanDays} days`,
    payload: { olderThanDays, deleted },
  });
  revalidatePath("/activity");
  return { ok: true, deleted };
}

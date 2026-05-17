"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  startTeamSession,
  verifyTeamPin,
  hasTeamPin,
  checkPinRateLimit,
  recordPinFailure,
  recordPinSuccess,
} from "@/lib/auth";

export type TeamUnlockState = { error?: string };

export async function teamUnlockAction(
  _prev: TeamUnlockState,
  formData: FormData
): Promise<TeamUnlockState> {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown";

  const rl = checkPinRateLimit(ip);
  if (!rl.allowed) {
    const mins = Math.ceil((rl.retryAfterSecs ?? 0) / 60);
    return { error: `Too many failed attempts. Try again in ${mins} minute(s).` };
  }

  if (!(await hasTeamPin())) {
    return { error: "Team access is not configured yet. Ask your admin to set a Team PIN in Settings." };
  }

  const pin = String(formData.get("pin") ?? "").trim();
  if (!pin) return { error: "Enter your team PIN" };

  const ok = await verifyTeamPin(pin);
  if (!ok) {
    recordPinFailure(ip);
    return { error: "Incorrect team PIN" };
  }

  recordPinSuccess(ip);
  await startTeamSession();
  redirect("/team/dashboard");
}

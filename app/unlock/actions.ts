"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { startSession, verifyPin, checkPinRateLimit, recordPinFailure, recordPinSuccess } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type UnlockState = { error?: string };

export async function unlockAction(
  _prev: UnlockState,
  formData: FormData
): Promise<UnlockState> {
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

  const pin = String(formData.get("pin") ?? "").trim();
  if (!pin) {
    await logAudit({
      action: "auth.unlock",
      status: "error",
      summary: "Unlock attempt: empty PIN",
      dealerId: null,
    });
    return { error: "Enter your PIN" };
  }
  const ok = await verifyPin(pin);
  if (!ok) {
    recordPinFailure(ip);
    await logAudit({
      action: "auth.unlock",
      status: "error",
      summary: "Unlock attempt: incorrect PIN",
      dealerId: null,
    });
    return { error: "Incorrect PIN" };
  }
  recordPinSuccess(ip);
  await startSession();
  await logAudit({
    action: "auth.unlock",
    summary: "Unlocked successfully",
    dealerId: null,
  });
  redirect("/dashboard");
}

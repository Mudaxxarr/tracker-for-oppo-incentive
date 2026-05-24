"use server";

import { redirect } from "next/navigation";
import {
  verifyAdminCredentials,
  setAdminCredentials,
  hasAdminCredentials,
  startSession,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type LoginState = { error?: string; fieldErrors?: Record<string, string> };

export async function adminLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) return { error: "Email and password are required." };

  const ok = await verifyAdminCredentials(email, password);
  if (!ok) {
    await logAudit({ action: "auth.login_fail", summary: `Failed admin login attempt for ${email}`, status: "error" });
    return { error: "Invalid email or password." };
  }

  await startSession();
  await logAudit({ action: "auth.login", summary: `Admin logged in as ${email}` });
  redirect("/dashboard");
}

export async function adminSetupAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (await hasAdminCredentials()) return { error: "Admin account already exists." };

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const confirm = (formData.get("confirm") as string | null) ?? "";

  const errors: Record<string, string> = {};
  if (!email || !email.includes("@")) errors.email = "Valid email required.";
  if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (password !== confirm) errors.confirm = "Passwords do not match.";
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  await setAdminCredentials(email, password);
  await startSession();
  redirect("/dashboard");
}

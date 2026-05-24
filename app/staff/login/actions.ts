"use server";
import { verifyStaffCredentials, startStaffSession } from "@/lib/staff-auth";

type LoginState = { error?: string; success?: boolean };

export async function staffLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = (formData.get("username") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  if (!username || !password) return { error: "Username and password are required" };
  const result = await verifyStaffCredentials(username, password);
  if (!result) return { error: "Invalid username or password" };
  await startStaffSession(result.id, result.role);
  // Return success so client can do a hard reload (bypasses router cache)
  return { success: true };
}

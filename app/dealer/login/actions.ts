"use server";

import { redirect } from "next/navigation";
import { verifyDealerCredentials, startDealerSession } from "@/lib/dealer-auth";
import { logAudit } from "@/lib/audit";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) return { error: "Email and password are required." };

  let creds: Awaited<ReturnType<typeof verifyDealerCredentials>>;
  try {
    creds = await verifyDealerCredentials(email, password);
  } catch (err) {
    await logAudit({
      action: "dealer_login_error",
      summary: `Login error for ${email}`,
      status: "error",
      payload: { email, error: String(err) },
      dealerId: null,
    });
    throw new Error("Login failed — database error. Please try again.", { cause: err });
  }

  if (!creds) return { error: "Invalid email or password." };

  await startDealerSession({
    tenantId: creds.tenantId,
    userId: creds.userId,
    role: creds.role,
    expiresAt: creds.expiresAt,
    status: creds.status as "active" | "grace" | "expired" | "suspended",
  });

  if (creds.status === "expired" || creds.status === "suspended") {
    redirect("/dealer/expired");
  }

  redirect("/dealer/dashboard");
}

"use server";

import { resetDealerUserPassword } from "@/lib/admin/dealers";
import { isAuthenticated } from "@/lib/auth";
import { z } from "zod";

const Schema = z.object({
  userId: z.string().min(1),
});

export type ResetPasswordState = {
  error?: string;
  credentials?: { email: string; tempPassword: string };
};

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  if (!(await isAuthenticated())) return { error: "Not authenticated" };
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  let result: Awaited<ReturnType<typeof resetDealerUserPassword>>;
  try {
    result = await resetDealerUserPassword(parsed.data.userId);
  } catch (err) {
    throw new Error("Failed to reset password", { cause: err });
  }

  return { credentials: { email: result.email, tempPassword: result.tempPassword } };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getDealerSession } from "@/lib/dealer-auth";
import { logAudit } from "@/lib/audit";

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

export type CreateAccountantState = {
  error?: string;
  ok?: boolean;
  email?: string;
  tempPassword?: string;
};

const EmailSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email") });

/** Main dealer (admin) creates the single accountant (exec) login. */
export async function createAccountantAction(
  _prev: CreateAccountantState,
  fd: FormData,
): Promise<CreateAccountantState> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  if (session.role !== "admin") return { error: "Only the main dealer can create an accountant login." };

  const parsed = EmailSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = parsed.data.email;

  const execs = await db
    .select({ id: schema.dealerUsers.id })
    .from(schema.dealerUsers)
    .where(and(eq(schema.dealerUsers.tenantId, session.tenantId), eq(schema.dealerUsers.role, "exec")));
  if (execs.length >= 1) return { error: "You already have an accountant login. Delete it first to create a new one." };

  const dup = await db.select({ id: schema.dealerUsers.id }).from(schema.dealerUsers).where(eq(schema.dealerUsers.email, email)).limit(1);
  if (dup.length > 0) return { error: "That email is already in use." };

  const tempPassword = genPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const id = randomUUID();
  await db.insert(schema.dealerUsers).values({
    id, tenantId: session.tenantId, email, passwordHash, role: "exec", isActive: true,
    createdAt: new Date().toISOString(),
  });

  await logAudit({ action: "dealer.accountant.create", entityType: "dealer_user", entityId: id, summary: `[Dealer] Created accountant login ${email}` });
  revalidatePath("/dealer/team");
  return { ok: true, email, tempPassword };
}

/** Remove the accountant (exec) login. Never touches the admin account. */
export async function deleteAccountantAction(userId: string): Promise<{ error?: string }> {
  const session = await getDealerSession();
  if (!session) return { error: "Not authenticated" };
  if (session.role !== "admin") return { error: "Not allowed" };

  const rows = await db
    .select({ role: schema.dealerUsers.role })
    .from(schema.dealerUsers)
    .where(and(eq(schema.dealerUsers.id, userId), eq(schema.dealerUsers.tenantId, session.tenantId)))
    .limit(1);
  if (rows.length === 0 || rows[0].role !== "exec") return { error: "Accountant not found" };

  await db.delete(schema.dealerUsers).where(and(eq(schema.dealerUsers.id, userId), eq(schema.dealerUsers.tenantId, session.tenantId)));
  await logAudit({ action: "dealer.accountant.delete", entityType: "dealer_user", entityId: userId, summary: `[Dealer] Deleted accountant login` });
  revalidatePath("/dealer/team");
  return {};
}

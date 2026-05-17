"use server";

import { createTenant } from "@/lib/admin/dealers";
import { z } from "zod";

const Schema = z.object({
  businessName: z.string().min(2).max(120),
  ownerEmail: z.string().email(),
  adminEmail: z.string().email(),
  planMonths: z.coerce.number().int().min(1).max(60),
});

export type CreateTenantState = {
  error?: string;
  credentials?: {
    tenantId: string;
    adminEmail: string;
    tempPassword: string;
    mailtoLink: string;
  };
};

export async function createTenantAction(
  _prev: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  let result: Awaited<ReturnType<typeof createTenant>>;
  try {
    result = await createTenant({
      businessName: d.businessName,
      ownerEmail: d.ownerEmail,
      adminEmail: d.adminEmail,
      planMonths: d.planMonths,
    });
  } catch (err) {
    throw new Error("Failed to create dealer account", { cause: err });
  }

  const subject = encodeURIComponent("Your OPPO Tracker Dealer Account");
  const body = encodeURIComponent(
    `Dear ${d.businessName},\n\nYour dealer account has been created.\n\nLogin URL: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.com"}/dealer/login\nEmail: ${d.adminEmail}\nTemp Password: ${result.tempPassword}\n\nPlease change your password after first login.\n\nRegards`,
  );
  const mailtoLink = `mailto:${d.adminEmail}?subject=${subject}&body=${body}`;

  return {
    credentials: {
      tenantId: result.tenantId,
      adminEmail: d.adminEmail,
      tempPassword: result.tempPassword,
      mailtoLink,
    },
  };
}

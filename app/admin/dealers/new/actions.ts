"use server";

import { Buffer } from "node:buffer";

import { createTenant } from "@/lib/admin/dealers";
import {
  ONBOARDING_DOC_MAX_BYTES,
  type DealerOnboardingProfile,
  type UploadedDocument,
} from "@/lib/admin/onboarding";
import { isAuthenticated } from "@/lib/auth";
import { z } from "zod";

const Schema = z.object({
  businessName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email(),
  mobileNumber: z.string().trim().min(7).max(40),
  whatsappNumber: z.string().trim().min(7).max(40),
  shopAddress: z.string().trim().min(5).max(240),
  cityRegion: z.string().trim().min(2).max(120),
  oppoDealerId: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().min(3).max(120),
  planMonths: z.coerce.number().int().min(1).max(60),
  staffCount: z.coerce.number().int().min(0).max(50),
});

type FieldErrors = Record<string, string>;

function firstError(value: unknown): string | undefined {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;
}

async function readRequiredDocument(
  formData: FormData,
  fieldName: string,
  label: string,
): Promise<UploadedDocument> {
  const value = formData.get(fieldName);
  if (!(value instanceof File) || value.size === 0) {
    throw new Error(`${label} is required.`);
  }
  if (value.size > ONBOARDING_DOC_MAX_BYTES) {
    throw new Error(`${label} must be 8 MB or smaller.`);
  }

  const bytes = Buffer.from(await value.arrayBuffer());
  const mimeType = value.type || "application/octet-stream";

  return {
    name: value.name || label,
    type: mimeType,
    size: value.size,
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
  };
}

async function readOnboardingProfile(formData: FormData): Promise<DealerOnboardingProfile> {
  return {
    businessName: String(formData.get("businessName") ?? "").trim(),
    ownerName: String(formData.get("ownerName") ?? "").trim(),
    email: String(formData.get("ownerEmail") ?? "").trim(),
    mobileNumber: String(formData.get("mobileNumber") ?? "").trim(),
    whatsappNumber: String(formData.get("whatsappNumber") ?? "").trim(),
    shopAddress: String(formData.get("shopAddress") ?? "").trim(),
    cityRegion: String(formData.get("cityRegion") ?? "").trim(),
    oppoDealerId: String(formData.get("oppoDealerId") ?? "").trim(),
    staffCount: Number(formData.get("staffCount") ?? 0),
    cnicFront: await readRequiredDocument(formData, "cnicFront", "CNIC front"),
    cnicBack: await readRequiredDocument(formData, "cnicBack", "CNIC back"),
    taxCertificate: await readRequiredDocument(
      formData,
      "taxCertificate",
      "Tax/NTN/Sales tax certificate",
    ),
  };
}

export type CreateTenantState = {
  error?: string;
  fieldErrors?: FieldErrors;
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
  if (!(await isAuthenticated())) return { error: "Not authenticated" };

  const parsed = Schema.safeParse({
    businessName: formData.get("businessName"),
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    mobileNumber: formData.get("mobileNumber"),
    whatsappNumber: formData.get("whatsappNumber"),
    shopAddress: formData.get("shopAddress"),
    cityRegion: formData.get("cityRegion"),
    oppoDealerId: formData.get("oppoDealerId"),
    adminEmail: formData.get("adminEmail"),
    planMonths: formData.get("planMonths"),
    staffCount: formData.get("staffCount"),
  });

  if (!parsed.success) {
    const raw = parsed.error.flatten().fieldErrors;
    const fieldErrors: FieldErrors = {};
    for (const [key, value] of Object.entries(raw)) {
      const message = firstError(value);
      if (message) fieldErrors[key] = message;
    }
    return { fieldErrors };
  }

  let onboardingProfile: DealerOnboardingProfile;
  try {
    onboardingProfile = await readOnboardingProfile(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid uploaded document." };
  }

  const d = parsed.data;

  let result: Awaited<ReturnType<typeof createTenant>>;
  try {
    result = await createTenant({
      businessName: d.businessName,
      ownerEmail: d.ownerEmail,
      adminEmail: d.adminEmail,
      planMonths: d.planMonths,
      onboardingProfile,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create dealer account",
    };
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

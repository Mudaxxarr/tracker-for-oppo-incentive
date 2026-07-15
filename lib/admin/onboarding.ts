import "server-only";

import { z } from "zod";

export const ONBOARDING_DOC_MAX_BYTES = 8 * 1024 * 1024;

const UploadedDocumentSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().int().nonnegative(),
  dataUrl: z.string().regex(/^data:/),
});

const DealerOnboardingProfileSchema = z.object({
  businessName: z.string().min(1),
  ownerName: z.string().min(1),
  email: z.string().min(1),
  mobileNumber: z.string().min(1),
  whatsappNumber: z.string().min(1),
  shopAddress: z.string().min(1),
  cityRegion: z.string().min(1),
  oppoDealerId: z.string().min(1),
  staffCount: z.number().int().min(0),
  cnicFront: UploadedDocumentSchema,
  cnicBack: UploadedDocumentSchema,
  taxCertificate: UploadedDocumentSchema,
});

export type UploadedDocument = z.infer<typeof UploadedDocumentSchema>;
export type DealerOnboardingProfile = z.infer<typeof DealerOnboardingProfileSchema>;

export function parseDealerOnboardingProfile(
  raw: string | null | undefined,
): DealerOnboardingProfile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = DealerOnboardingProfileSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function serializeDealerOnboardingProfile(profile: DealerOnboardingProfile): string {
  return JSON.stringify(profile);
}

import { NextResponse } from "next/server";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantById } from "@/lib/admin/dealers";
import { buildDealerProfileCertificatePDF } from "@/lib/export/dealer-profile-certificate-pdf";

function safeFilename(value: string) {
  return value
    .replace(/[^\w\s.-]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80) || "dealer_profile";
}

export async function GET() {
  const session = await getDealerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getTenantById(session.tenantId);
  if (!tenant) return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
  if (!tenant.onboardingProfile) {
    return NextResponse.json({ error: "Dealer profile not available" }, { status: 404 });
  }

  const pdf = await buildDealerProfileCertificatePDF({
    businessName: tenant.businessName,
    ownerEmail: tenant.ownerEmail,
    planMonths: tenant.planMonths,
    startedAt: tenant.startedAt,
    expiresAt: tenant.expiresAt,
    profile: tenant.onboardingProfile,
  });

  const filename = `OPPO_Dealer_Profile_${safeFilename(tenant.businessName)}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

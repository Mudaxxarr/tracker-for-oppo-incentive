import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantById } from "@/lib/admin/dealers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, BadgeCheck } from "lucide-react";

export default async function DealerProfilePage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const tenant = await getTenantById(session.tenantId);
  if (!tenant) redirect("/dealer/login");

  const profile = tenant.onboardingProfile;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Your dealer identity and onboarding record.
          </p>
        </div>
        <a
          href="/api/dealer/profile-certificate"
          className={cn(buttonVariants({ size: "sm" }), "gap-2")}
        >
          <Download className="size-4" />
          Download certificate
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgeCheck className="size-4" />
            Dealer registration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <InfoRow label="Business name" value={tenant.businessName} />
          <InfoRow label="Owner name" value={profile?.ownerName ?? "—"} />
          <InfoRow label="Dealer login ID" value={tenant.ownerEmail} />
          <InfoRow label="OPPO dealer ID" value={profile?.oppoDealerId ?? "—"} />
          <InfoRow label="Mobile number" value={profile?.mobileNumber ?? "—"} />
          <InfoRow label="WhatsApp number" value={profile?.whatsappNumber ?? "—"} />
          <InfoRow label="Email" value={profile?.email ?? "—"} />
          <InfoRow label="City / region" value={profile?.cityRegion ?? "—"} />
          <InfoRow label="Staff using app" value={profile ? String(profile.staffCount) : "—"} />
          <InfoRow label="Shop address" value={profile?.shopAddress ?? "—"} full />
        </CardContent>
      </Card>

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uploaded documents</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <DocTile label="CNIC Front" name={profile.cnicFront.name} />
            <DocTile label="CNIC Back" name={profile.cnicBack.name} />
            <DocTile label="Tax / NTN / Sales tax certificate" name={profile.taxCertificate.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "space-y-1" : "flex items-center justify-between gap-4"}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={full ? "rounded-lg border bg-muted/20 px-3 py-2" : "font-medium"}>{value}</dd>
    </div>
  );
}

function DocTile({ label, name }: { label: string; name: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{name}</p>
    </div>
  );
}

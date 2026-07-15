import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantById } from "@/lib/admin/dealers";
import { db, schema } from "@/lib/db/client";
import { and, count, eq, gte, lte } from "drizzle-orm";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/feature/kpi-card";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ExternalLink, Smartphone, CalendarDays, Package } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

async function getTenantKpis(tenantId: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [todayRows, monthRows, purchaseRows] = await Promise.all([
    db
      .select({ c: count() })
      .from(schema.activations)
      .where(
        and(
          eq(schema.activations.tenantId, tenantId),
          eq(schema.activations.activationDate, today),
        ),
      ),
    db
      .select({ c: count() })
      .from(schema.activations)
      .where(
        and(
          eq(schema.activations.tenantId, tenantId),
          gte(schema.activations.activationDate, monthStart),
          lte(schema.activations.activationDate, monthEnd),
        ),
      ),
    db
      .select({ c: count() })
      .from(schema.purchases)
      .where(eq(schema.purchases.tenantId, tenantId)),
  ]);

  return {
    todayActivations: Number(todayRows[0]?.c ?? 0),
    monthActivations: Number(monthRows[0]?.c ?? 0),
    totalPurchases: Number(purchaseRows[0]?.c ?? 0),
  };
}

export default async function AdminDealerDetailPage({ params }: Props) {
  const { id } = await params;
  const [tenant, kpis] = await Promise.all([getTenantById(id), getTenantKpis(id)]);

  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tenant.businessName}</h1>
          <p className="text-sm text-muted-foreground">{tenant.ownerEmail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/impersonate/${id}`}
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <ExternalLink className="size-4" />
            Enter Portal
          </a>
          <Link href={`/admin/dealers/${id}/settings`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Settings</Link>
          <Link href={`/admin/dealers/${id}/features`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Features</Link>
          <Link href={`/admin/dealers/${id}/billing`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Billing</Link>
          <Link href={`/admin/dealers/${id}/renew`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Renew</Link>
          <Link href={`/admin/dealers/${id}/team`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Team</Link>
          <Link href={`/admin/dealers/${id}/reset-password`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Reset Password</Link>
          <Link href={`/admin/dealers/${id}/backups`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Backups</Link>
          <Link href="/admin/dealers" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Back</Link>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Badge>{tenant.status}</Badge>
        <span className="text-muted-foreground">Expires: {tenant.expiresAt}</span>
        <span className="text-muted-foreground">&middot; Plan: {tenant.planMonths} months</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Today's Activations"
          value={kpis.todayActivations}
          icon={<Smartphone className="size-4" />}
        />
        <KpiCard
          label="Month Activations"
          value={kpis.monthActivations}
          icon={<CalendarDays className="size-4" />}
        />
        <KpiCard
          label="Total Purchases"
          value={kpis.totalPurchases}
          icon={<Package className="size-4" />}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Users</h2>
        <div className="space-y-2">
          {tenant.users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{u.email}</p>
                <p className="text-xs text-muted-foreground">
                  {u.role} &middot; {u.isActive ? "Active" : "Inactive"} &middot; joined{" "}
                  {u.createdAt.slice(0, 10)}
                </p>
              </div>
              <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
            </div>
          ))}
        </div>
      </div>

      {tenant.onboardingProfile && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Onboarding details</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard label="Owner name" value={tenant.onboardingProfile.ownerName} />
            <InfoCard label="Email" value={tenant.onboardingProfile.email} />
            <InfoCard label="Mobile number" value={tenant.onboardingProfile.mobileNumber} />
            <InfoCard label="WhatsApp number" value={tenant.onboardingProfile.whatsappNumber} />
            <InfoCard label="City/region" value={tenant.onboardingProfile.cityRegion} />
            <InfoCard label="OPPO dealer ID" value={tenant.onboardingProfile.oppoDealerId} />
            <InfoCard label="Staff count" value={String(tenant.onboardingProfile.staffCount)} />
            <InfoCard label="Shop address" value={tenant.onboardingProfile.shopAddress} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <DocumentCard label="CNIC front" doc={tenant.onboardingProfile.cnicFront} />
            <DocumentCard label="CNIC back" doc={tenant.onboardingProfile.cnicBack} />
            <DocumentCard label="Tax certificate" doc={tenant.onboardingProfile.taxCertificate} />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function DocumentCard({
  label,
  doc,
}: {
  label: string;
  doc: { name: string; type: string; size: number; dataUrl: string };
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{doc.name}</p>
      <p className="text-xs text-muted-foreground">
        {doc.type} - {Math.max(1, Math.round(doc.size / 1024))} KB
      </p>
      <a
        href={doc.dataUrl}
        download={doc.name}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
      >
        Download
      </a>
    </div>
  );
}

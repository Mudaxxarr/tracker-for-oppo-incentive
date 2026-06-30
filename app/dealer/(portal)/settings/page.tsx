import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { isFeatureKeyOn } from "@/lib/feature-registry";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { getConstants } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { DealerSettingsClient } from "./dealer-settings-client";

export default async function DealerSettingsPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "settings")) return <FeatureDisabled />;

  const [rows, constants] = await Promise.all([
    db
      .select({
        businessName: schema.dealerTenants.businessName,
        ownerEmail: schema.dealerTenants.ownerEmail,
        status: schema.dealerTenants.status,
        expiresAt: schema.dealerTenants.expiresAt,
        planMonths: schema.dealerTenants.planMonths,
      })
      .from(schema.dealerTenants)
      .where(eq(schema.dealerTenants.id, session.tenantId))
      .limit(1),
    getConstants(),
  ]);

  const tenant = rows[0];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="size-4" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Business Name</dt>
              <dd className="font-medium">{tenant?.businessName ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Owner Email</dt>
              <dd>{tenant?.ownerEmail ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={tenant?.status === "active" ? "default" : "secondary"}>
                  {tenant?.status ?? "—"}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subscription Expires</dt>
              <dd>{tenant?.expiresAt ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Plan</dt>
              <dd>{tenant?.planMonths != null ? `${tenant.planMonths} months` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Your Role</dt>
              <dd className="capitalize">{session.role}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Interactive sections (client component) */}
      <DealerSettingsClient
        basePercent={constants.basePercent}
        defaultBonusPercent={constants.defaultBonusPercent}
        canBackup={isFeatureKeyOn(features, "set_backup")}
        canPurge={isFeatureKeyOn(features, "set_purge")}
      />
    </div>
  );
}

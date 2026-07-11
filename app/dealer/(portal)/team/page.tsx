import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { DealerTeamClient } from "./dealer-team-client";

export default async function DealerTeamViewPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  if (session.role === "exec") redirect("/dealer/dashboard");

  const features = await getTenantFeaturesById(session.tenantId);
  if (!isFeatureEnabled(features, "team")) return <FeatureDisabled />;

  const users = await db
    .select({
      id: schema.dealerUsers.id,
      email: schema.dealerUsers.email,
      role: schema.dealerUsers.role,
      isActive: schema.dealerUsers.isActive,
      createdAt: schema.dealerUsers.createdAt,
    })
    .from(schema.dealerUsers)
    .where(eq(schema.dealerUsers.tenantId, session.tenantId));

  return <DealerTeamClient members={users} isAdmin={session.role === "admin"} />;
}

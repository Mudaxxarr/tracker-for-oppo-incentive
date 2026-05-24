import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { FeatureDisabled } from "@/components/dealer/feature-disabled";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default async function DealerTeamViewPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="size-5" />
        <h1 className="text-xl font-semibold">Team View</h1>
      </div>

      {users.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No team members found.
        </p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{u.email}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {u.role} · joined {u.createdAt.slice(0, 10)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.isActive ? "default" : "secondary"}>
                  {u.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge variant={u.role === "admin" ? "outline" : "secondary"} className="capitalize">
                  {u.role}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

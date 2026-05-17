import { getDealerIdsAction, setActiveDealerAction } from "./actions";
import { getActiveDealerIdForTenant } from "@/lib/dealer-tenant";
import { getDealerSession } from "@/lib/dealer-auth";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";

export default async function DealerIdsPage() {
  const session = await getDealerSession();
  if (!session) return null;

  const [ids, activeId] = await Promise.all([
    getDealerIdsAction(),
    getActiveDealerIdForTenant(session.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dealer IDs</h1>
        <p className="text-sm text-muted-foreground">
          Select the active dealer ID for this session.
        </p>
      </div>

      <div className="space-y-2">
        {ids.map((d) => {
          const isActive = d.id === activeId;
          return (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {isActive ? (
                  <CheckCircle2 className="size-5 text-primary" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  {d.note && (
                    <p className="text-xs text-muted-foreground">{d.note}</p>
                  )}
                </div>
              </div>
              {!isActive && (
                <form
                  action={async () => {
                    "use server";
                    await setActiveDealerAction(d.id);
                  }}
                >
                  <Button type="submit" variant="outline" size="sm">
                    Select
                  </Button>
                </form>
              )}
            </div>
          );
        })}
        {ids.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No dealer IDs found. The administrator must add dealer IDs for your account.
          </p>
        )}
      </div>
    </div>
  );
}

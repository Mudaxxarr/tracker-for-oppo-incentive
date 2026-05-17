import { listDealerActivationsAction, deleteDealerActivationAction } from "./actions";
import { DealerActivationForm } from "./dealer-activation-form";
import { getDealerSession } from "@/lib/dealer-auth";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DealerActivationsPage() {
  const [session, data] = await Promise.all([
    getDealerSession(),
    listDealerActivationsAction(),
  ]);
  const isAdmin = session?.role === "admin";
  const { activations, models } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Activations</h1>

      <DealerActivationForm models={models.map((m) => ({ id: m.id, name: m.name }))} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {activations.length} record{activations.length !== 1 ? "s" : ""}
        </h2>
        {activations.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{a.imei ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {a.modelName} &middot; {format(new Date(a.activationDate), "dd MMM yyyy")}
              </p>
            </div>
            {isAdmin && (
              <form
                action={async () => {
                  "use server";
                  await deleteDealerActivationAction(a.id);
                }}
              >
                <Button type="submit" variant="ghost" size="icon" className="text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </form>
            )}
          </div>
        ))}
        {activations.length === 0 && (
          <p className="text-sm text-muted-foreground">No activations yet.</p>
        )}
      </div>
    </div>
  );
}

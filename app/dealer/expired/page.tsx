import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "../actions";

export default function DealerExpiredPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-background to-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <ShieldOff className="mx-auto size-12 text-destructive" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Subscription Inactive</h1>
          <p className="text-sm text-muted-foreground">
            Your dealer subscription has expired or been suspended. Contact the
            administrator to renew access.
          </p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out and try again
          </Button>
        </form>
      </div>
    </main>
  );
}

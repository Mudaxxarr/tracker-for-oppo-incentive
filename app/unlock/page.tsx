import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { UnlockForm } from "./unlock-form";
import { APP_NAME } from "@/lib/constants";

export default async function UnlockPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-background to-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-muted-foreground">Enter your PIN to continue</p>
        </div>
        <UnlockForm />
        <p className="text-center text-xs text-muted-foreground">
          Default PIN <span className="font-mono">123456</span> — change it in Settings
        </p>
      </div>
    </main>
  );
}

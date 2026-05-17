import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { LoginForm } from "./login-form";

export default async function DealerLoginPage() {
  const session = await getDealerSession();
  if (session && session.status !== "expired" && session.status !== "suspended") {
    redirect("/dealer/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-background to-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Alhamd OPPO Tracker</h1>
          <p className="text-sm text-muted-foreground">Sign in to your dealer account</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

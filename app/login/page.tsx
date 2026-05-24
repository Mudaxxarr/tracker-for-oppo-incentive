import { redirect } from "next/navigation";
import { isAuthenticated, hasAdminCredentials } from "@/lib/auth";
import { AdminLoginForm, AdminSetupForm } from "./login-form";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/dashboard");
  const setup = !(await hasAdminCredentials());

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-background to-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Alhamd OPPO Tracker</h1>
          <p className="text-sm text-muted-foreground">
            {setup ? "Welcome — set up your admin account to get started." : "Sign in to continue."}
          </p>
        </div>
        {setup ? <AdminSetupForm /> : <AdminLoginForm />}
      </div>
    </main>
  );
}

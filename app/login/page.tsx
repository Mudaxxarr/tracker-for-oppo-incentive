import { redirect } from "next/navigation";
import { isAuthenticated, hasAdminCredentials } from "@/lib/auth";
import { resolveLoginRedirect } from "@/lib/admin/manager";
import { AdminLoginForm, AdminSetupForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = resolveLoginRedirect(next);
  if (await isAuthenticated()) redirect(nextPath);
  const setup = !(await hasAdminCredentials());

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Alhamd Telecom</p>
          <h1 className="text-xl font-semibold tracking-tight">
            {setup ? "Create admin account" : "Sales Console"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {setup ? "Set up your credentials to access the console." : "Sign in to access your portal."}
          </p>
        </div>
        {setup
          ? <AdminSetupForm nextPath={nextPath} />
          : <AdminLoginForm nextPath={nextPath} />}
        <p className="text-center text-xs text-muted-foreground">
          Dealer and staff portals have separate login links.
        </p>
      </div>
    </main>
  );
}

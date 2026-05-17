import { isTeamAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TeamUnlockForm } from "./unlock-form";

export default async function TeamUnlockPage() {
  if (await isTeamAuthenticated()) redirect("/team/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <TeamUnlockForm />
    </div>
  );
}

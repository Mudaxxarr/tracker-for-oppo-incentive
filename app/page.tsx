import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default async function RootPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }
  redirect("/unlock");
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listDealerTeamMembers } from "@/lib/admin/dealers";
import { TeamClient } from "./team-client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic";

export default async function DealerTeamPage({ params }: Props) {
  if (!(await isAuthenticated())) redirect("/login");
  const { id } = await params;
  if (!id) notFound();

  const members = await listDealerTeamMembers(id);

  return (
    <div className="space-y-4">
      <Link href={`/admin/dealers/${id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}>
        ← Back to Dealer
      </Link>
      <TeamClient tenantId={id} members={members} />
    </div>
  );
}

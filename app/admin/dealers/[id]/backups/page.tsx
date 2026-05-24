import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantById } from "@/lib/admin/dealers";
import { listDealerBackups } from "@/lib/admin/backups";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DealerBackupsPage({ params }: Props) {
  const { id } = await params;
  const [tenant, backups] = await Promise.all([getTenantById(id), listDealerBackups(id)]);
  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Backups — {tenant.businessName}</h1>
          <p className="text-sm text-muted-foreground">Last 2 daily snapshots (today + yesterday)</p>
        </div>
        <Link
          href={`/admin/dealers/${id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Back
        </Link>
      </div>

      {backups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No backups yet. Snapshots are created automatically when the dealer accesses their portal.
        </p>
      ) : (
        <div className="max-w-lg space-y-2">
          {backups.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{b.backupDate}</p>
                <p className="text-xs text-muted-foreground">
                  Captured: {b.createdAt.slice(0, 19).replace("T", " ")} UTC
                </p>
              </div>
              <a
                href={`/api/admin/backup/${b.id}`}
                download={`backup-${id.slice(0, 8)}-${b.backupDate}.json`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Download className="mr-1 size-4" />
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

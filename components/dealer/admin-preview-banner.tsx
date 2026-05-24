import { exitAdminPreviewAction } from "@/app/dealer/actions-admin";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

interface Props {
  tenantId: string;
  businessName: string;
}

const linkCls = "rounded border border-white/40 bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30";

export function AdminPreviewBanner({ tenantId, businessName }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2.5 text-sm font-medium text-white">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 shrink-0" />
        <span>
          Admin preview — viewing as <strong>{businessName}</strong>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/dealers/${tenantId}/features`} className={linkCls}>
          Features
        </Link>
        <Link href="/admin/dealers" className={linkCls}>
          All Dealers
        </Link>
        <Link href={`/admin/dealers/${tenantId}`} className={linkCls}>
          Dealer Admin
        </Link>
        <form action={exitAdminPreviewAction}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <button type="submit" className={linkCls}>
            ← Exit to Admin
          </button>
        </form>
      </div>
    </div>
  );
}

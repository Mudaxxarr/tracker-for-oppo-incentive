import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { ne } from "drizzle-orm";
import { ensureTodayBackup } from "@/lib/admin/backups";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenants = await db
    .select({ id: schema.dealerTenants.id })
    .from(schema.dealerTenants)
    .where(ne(schema.dealerTenants.id, "owner"));

  const results = await Promise.allSettled(
    tenants.map((t) => ensureTodayBackup(t.id)),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  if (failed > 0) {
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => String(r.reason));
    console.error("Backup cron failures:", errors);
  }

  return NextResponse.json({ succeeded, failed, total: tenants.length });
}

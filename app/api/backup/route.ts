import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const tmpPath = path.join(os.tmpdir(), `oppo-backup-${stamp}.db`);

  try {
    // Use better-sqlite3's online backup API — coordinates with WAL to produce
    // a consistent snapshot even while writes are in flight.
    await db.$client.backup(tmpPath);
    const buf = fs.readFileSync(tmpPath);
    await logAudit({
      action: "settings.backup_download",
      summary: `Downloaded backup (${(buf.length / 1024).toFixed(0)} KB)`,
      payload: { sizeBytes: buf.length },
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="oppo-tracker-${stamp}.db"`,
      },
    });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* best-effort cleanup */ }
  }
}

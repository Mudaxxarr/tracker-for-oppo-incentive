import { type NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getBackupById } from "@/lib/admin/backups";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const backup = await getBackupById(id);
  if (!backup) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const b = backup as { tenantId: string; backupDate: string };
  const filename = `backup-${b.tenantId.slice(0, 8)}-${b.backupDate}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

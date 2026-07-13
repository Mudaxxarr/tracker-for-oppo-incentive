import { type NextRequest, NextResponse } from "next/server";
import { drainRebateJobs } from "@/lib/db/queries/rebate-jobs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await drainRebateJobs();
  return NextResponse.json(result);
}

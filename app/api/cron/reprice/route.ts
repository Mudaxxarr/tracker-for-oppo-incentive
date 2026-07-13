import { type NextRequest, NextResponse } from "next/server";
import { drainRebateJobs } from "@/lib/db/queries/rebate-jobs";

/**
 * Drains the rebate_jobs queue (background rebate recompute after an owner price
 * change). Safety net behind the `after()` fast path in the price-mutation
 * actions. Two auth modes:
 *   - GET  + `Authorization: Bearer $CRON_SECRET`  → Vercel-native cron (vercel.json)
 *   - POST + `x-cron-secret: $CRON_SECRET`         → manual / external scheduler
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await drainRebateJobs();
  return NextResponse.json(result);
}

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

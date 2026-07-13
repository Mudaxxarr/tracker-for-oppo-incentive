import "server-only";
import { db, schema } from "../client";
import { asc, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { reEvaluateRebatesForDealer } from "./rebates";
import { OWNER_TENANT_ID } from "@/lib/dealer";

/** Queue a background rebate recompute for all non-owner dealers of a model. */
export async function enqueueRebateJob(modelId: string, fromDate: string): Promise<void> {
  await db.insert(schema.rebateJobs).values({
    id: randomUUID(),
    modelId,
    fromDate,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

/**
 * Process every pending job: recompute rebates for all dealers in every
 * NON-owner tenant (owner's own dealers are handled synchronously at price-edit
 * time). Idempotent — reEvaluateRebatesForDealer deletes+recreates, so a re-run
 * (cron retry after a killed instance) produces identical rows. One dealer's
 * failure is logged and skipped; a job is marked done only after its full pass.
 */
export async function drainRebateJobs(): Promise<{ jobsProcessed: number; dealersTouched: number }> {
  const jobs = await db
    .select()
    .from(schema.rebateJobs)
    .where(eq(schema.rebateJobs.status, "pending"))
    .orderBy(asc(schema.rebateJobs.createdAt));

  let dealersTouched = 0;
  for (const job of jobs) {
    const dealers = await db
      .select({ id: schema.dealerIds.id, tenantId: schema.dealerIds.tenantId })
      .from(schema.dealerIds)
      .where(ne(schema.dealerIds.tenantId, OWNER_TENANT_ID));

    for (const d of dealers) {
      try {
        await reEvaluateRebatesForDealer(OWNER_TENANT_ID, d.id, job.modelId, job.fromDate, d.tenantId);
        dealersTouched++;
      } catch (e) {
        console.error("[rebate-job]", job.id, d.id, e);
      }
    }
    await db.update(schema.rebateJobs).set({ status: "done" }).where(eq(schema.rebateJobs.id, job.id));
  }
  return { jobsProcessed: jobs.length, dealersTouched };
}

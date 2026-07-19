import "server-only";
import { db, schema } from "../client";
import { asc, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { reEvaluateRebatesForDealer } from "./rebates";
import { createOwnerAlert } from "./alerts";
import { OWNER_TENANT_ID } from "@/lib/dealer";
import { OWNER_ALERT_TYPE } from "@/lib/constants";

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
export async function drainRebateJobs(): Promise<{ jobsProcessed: number; dealersTouched: number; dealersFailed: number }> {
  const jobs = await db
    .select()
    .from(schema.rebateJobs)
    .where(eq(schema.rebateJobs.status, "pending"))
    .orderBy(asc(schema.rebateJobs.createdAt));

  const dealers = await db
    .select({ id: schema.dealerIds.id, tenantId: schema.dealerIds.tenantId })
    .from(schema.dealerIds)
    .where(ne(schema.dealerIds.tenantId, OWNER_TENANT_ID));

  // Each dealer's rebate recompute is independent - run concurrently in small
  // chunks (not one unbounded Promise.all) so this doesn't try to claim more
  // connections than the pool has (max 20, lib/db/client.ts).
  const CONCURRENCY = 8;
  let dealersTouched = 0;
  let dealersFailed = 0;
  for (const job of jobs) {
    for (let i = 0; i < dealers.length; i += CONCURRENCY) {
      const chunk = dealers.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map((d) =>
          reEvaluateRebatesForDealer(OWNER_TENANT_ID, d.id, job.modelId, job.fromDate, d.tenantId)
            .then(() => true)
            .catch((e) => {
              console.error("[rebate-job]", job.id, d.id, e);
              return false;
            })
        )
      );
      dealersTouched += results.filter(Boolean).length;
      dealersFailed += results.filter((r) => !r).length;
    }
    // Mark done even on partial failure — reruns are idempotent but an unbounded
    // retry loop over a permanently-failing dealer would starve the queue.
    // Instead surface the failure so a human can investigate + re-save the price.
    await db.update(schema.rebateJobs).set({ status: "done" }).where(eq(schema.rebateJobs.id, job.id));
  }

  // Financial data silently going stale is the worst failure mode here — a rebate
  // recompute that errored leaves a dealer's payout figure wrong with no trace
  // beyond a server log. Raise a single owner alert so it can't pass unnoticed.
  if (dealersFailed > 0) {
    await createOwnerAlert({
      tenantId: OWNER_TENANT_ID,
      type: OWNER_ALERT_TYPE.REBATE_JOB_FAILED,
      entityType: "rebate_job",
      entityId: randomUUID(),
      dealerId: null,
      message: `Background rebate recompute failed ${dealersFailed} time(s) across ${jobs.length} price change(s). Affected dealers may show stale payout totals — check server logs, then re-save the model's price to retry.`,
    }).catch((e) => console.error("[rebate-job-alert]", e));
  }

  return { jobsProcessed: jobs.length, dealersTouched, dealersFailed };
}

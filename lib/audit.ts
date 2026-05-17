import "server-only";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { db, schema } from "./db/client";
import { and, desc, eq, gte, like, lte, sql, type SQL } from "drizzle-orm";
import { getActiveDealerId } from "./dealer";

export type AuditStatus = "ok" | "error";

export interface AuditEvent {
  action: string;
  summary: string;
  status?: AuditStatus;
  entityType?: string | null;
  entityId?: string | null;
  payload?: unknown;
  /** Override the active dealer (e.g., for auth events before any dealer is selected). */
  dealerId?: string | null;
}

/**
 * Record one user action. Never throws — failure to log must not break the user flow.
 *
 * All write-paths in `app/(app)/.../actions.ts` should call this exactly once on
 * success and once on error. Reads (page loads) are NOT logged to keep the table
 * meaningful.
 */
export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    const hdrs = await headers();
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      hdrs.get("x-real-ip") ??
      null;
    const userAgent = hdrs.get("user-agent") ?? null;

    let dealerId: string | null;
    if (event.dealerId !== undefined) {
      dealerId = event.dealerId;
    } else {
      try {
        dealerId = await getActiveDealerId();
      } catch {
        dealerId = null;
      }
    }

    await db.insert(schema.auditLog).values({
      id: randomUUID(),
      action: event.action,
      dealerId,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      status: event.status ?? "ok",
      payload: event.payload != null ? JSON.stringify(event.payload) : null,
      summary: event.summary,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    // Logging must never break the user flow.
    // eslint-disable-next-line no-console
    console.warn("[audit] failed to log:", err);
  }
}

export interface AuditFilters {
  dealerId?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function listAuditLog(filters: AuditFilters = {}) {
  const where: SQL[] = [];
  if (filters.dealerId) where.push(eq(schema.auditLog.dealerId, filters.dealerId));
  if (filters.action) where.push(like(schema.auditLog.action, `${filters.action}%`));
  if (filters.search) where.push(like(schema.auditLog.summary, `%${filters.search}%`));
  if (filters.from) where.push(gte(schema.auditLog.createdAt, filters.from));
  if (filters.to) where.push(lte(schema.auditLog.createdAt, filters.to));
  const q = db
    .select()
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(filters.limit ?? 200);
  return where.length === 0 ? q : q.where(and(...where));
}

/** Permanently delete log rows older than `olderThanDays`. Returns count. */
export async function purgeAuditLog(olderThanDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 3600 * 1000).toISOString();
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.auditLog)
    .where(lte(schema.auditLog.createdAt, cutoff));
  const count = Number(n);
  if (count > 0) {
    await db.delete(schema.auditLog).where(lte(schema.auditLog.createdAt, cutoff));
  }
  return count;
}

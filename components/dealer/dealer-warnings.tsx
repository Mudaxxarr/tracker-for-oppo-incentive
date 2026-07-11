import { db, schema } from "@/lib/db/client";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import Link from "next/link";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Main-dealer warnings, computed on dashboard load. Two triggers:
 *  1. Accountant (exec) posted a Cross-Region OUT recently.
 *  2. No purchase/activation posted for 3+ days. */
export async function DealerWarnings({ tenantId, dealerId }: { tenantId: string; dealerId: string }) {
  // eslint-disable-next-line react-hooks/purity -- async server component; time read once per request
  const now = Date.now();
  const threeDaysAgo = iso(new Date(now - 3 * 86_400_000));
  const sevenDaysAgo = iso(new Date(now - 7 * 86_400_000));

  const execs = await db
    .select({ id: schema.dealerUsers.id })
    .from(schema.dealerUsers)
    .where(and(eq(schema.dealerUsers.tenantId, tenantId), eq(schema.dealerUsers.role, "exec")));
  const execIds = execs.map((e) => e.id);

  const [lastPur, lastAct, subCr] = await Promise.all([
    db.select({ d: sql<string | null>`MAX(${schema.purchases.purchaseDate})` }).from(schema.purchases)
      .where(and(eq(schema.purchases.tenantId, tenantId), eq(schema.purchases.dealerId, dealerId))),
    db.select({ d: sql<string | null>`MAX(${schema.activations.activationDate})` }).from(schema.activations)
      .where(and(eq(schema.activations.tenantId, tenantId), eq(schema.activations.dealerId, dealerId))),
    execIds.length > 0
      ? db
          .select({ qty: schema.crCaught.quantity, date: schema.crCaught.caughtDate, model: schema.models.name })
          .from(schema.crCaught)
          .innerJoin(schema.models, eq(schema.models.id, schema.crCaught.modelId))
          .where(and(
            eq(schema.crCaught.tenantId, tenantId),
            eq(schema.crCaught.dealerId, dealerId),
            inArray(schema.crCaught.createdByUserId, execIds),
            gte(schema.crCaught.caughtDate, sevenDaysAgo),
          ))
          .orderBy(desc(schema.crCaught.caughtDate))
          .limit(5)
      : Promise.resolve([] as { qty: number; date: string; model: string }[]),
  ]);

  const dates = [lastPur[0]?.d, lastAct[0]?.d].filter((x): x is string => !!x).sort();
  const lastPost = dates.at(-1) ?? null;
  const inactive = !lastPost || lastPost < threeDaysAgo;

  const items: React.ReactNode[] = [];

  if (subCr.length > 0) {
    items.push(
      <Banner key="subcr" tone="alert" Icon={ShieldAlert} title="Accountant posted Cross-Region OUT" href="/dealer/cross-region">
        {subCr.length} recent CR-OUT by your accountant: {subCr.map((c) => `${c.qty}× ${c.model} (${c.date})`).join(", ")}. Tap to review.
      </Banner>,
    );
  }
  if (inactive) {
    items.push(
      <Banner key="inactive" tone="warn" Icon={AlertTriangle} title="No posting in 3+ days">
        {lastPost
          ? `Last purchase/activation was on ${lastPost}. If your shop is running, remind your team to post.`
          : "No purchases or activations posted yet."}
      </Banner>,
    );
  }

  if (items.length === 0) return null;
  return <div className="space-y-2">{items}</div>;
}

function Banner({
  tone, Icon, title, href, children,
}: {
  tone: "alert" | "warn";
  Icon: typeof AlertTriangle;
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  const cls = tone === "alert"
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  const inner = (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cls}`}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-90">{children}</p>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

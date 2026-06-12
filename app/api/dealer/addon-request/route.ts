import { NextResponse } from "next/server";
import { getDealerSession } from "@/lib/dealer-auth";
import { getAddon, isAddonEnabled } from "@/lib/dealer-addons";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { db, schema } from "@/lib/db/client";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function POST(req: Request) {
  const session = await getDealerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let addonKey: string;
  try {
    const body = (await req.json()) as { addon?: string };
    addonKey = body.addon ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const addon = getAddon(addonKey);
  if (!addon) return NextResponse.json({ error: "Unknown add-on" }, { status: 400 });

  const features = await getTenantFeaturesById(session.tenantId);
  if (isAddonEnabled(features, addon.key)) {
    return NextResponse.json({ ok: true, alreadyEnabled: true });
  }

  // Dedupe: one unread request alert per tenant per add-on.
  const entityId = `addon_request_${session.tenantId}_${addon.key}`;
  const existing = await db
    .select({ id: schema.ownerAlerts.id })
    .from(schema.ownerAlerts)
    .where(sql`${schema.ownerAlerts.entityId} = ${entityId} AND ${schema.ownerAlerts.isRead} = false`)
    .limit(1);
  if (existing.length > 0) return NextResponse.json({ ok: true, deduped: true });

  const tenantRows = await db
    .select({ businessName: schema.dealerTenants.businessName })
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, session.tenantId))
    .limit(1);
  const businessName = tenantRows[0]?.businessName ?? session.tenantId;

  await db.insert(schema.ownerAlerts).values({
    id: randomUUID(),
    tenantId: "owner",
    type: "addon_request",
    entityType: "dealer_tenant",
    entityId,
    dealerId: null,
    message: `${businessName} requested the ${addon.label} add-on (PKR ${addon.monthlyPrice}/month)`,
    isRead: false,
    payload: JSON.stringify({
      tenantId: session.tenantId,
      addon: addon.key,
      monthlyPrice: addon.monthlyPrice,
      requestedBy: session.userId,
    }),
  });

  return NextResponse.json({ ok: true });
}

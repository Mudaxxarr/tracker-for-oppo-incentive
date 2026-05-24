import { NextResponse } from "next/server";
import { getDealerSession } from "@/lib/dealer-auth";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getDealerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId } = session;

  const [activations, purchases, dealerIds, interIdTransfers, crCaught] = await Promise.all([
    db.select().from(schema.activations).where(eq(schema.activations.tenantId, tenantId)),
    db.select().from(schema.purchases).where(eq(schema.purchases.tenantId, tenantId)),
    db.select().from(schema.dealerIds).where(eq(schema.dealerIds.tenantId, tenantId)),
    db.select().from(schema.interIdTransfers).where(eq(schema.interIdTransfers.tenantId, tenantId)),
    db.select().from(schema.crCaught).where(eq(schema.crCaught.tenantId, tenantId)),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    tenantId,
    activations,
    purchases,
    dealerIds,
    interIdTransfers,
    crCaught,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="dealer_backup_${date}.json"`,
    },
  });
}

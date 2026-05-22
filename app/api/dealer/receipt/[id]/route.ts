import { NextResponse } from "next/server";
import { getDealerSession } from "@/lib/dealer-auth";
import { getActiveDealerIdForTenant, getTenantById } from "@/lib/dealer-tenant";
import { buildReceipt } from "@/lib/export/receipt-pdf";
import { db, schema } from "@/lib/db/client";
import { and, eq } from "drizzle-orm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDealerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dealerId = await getActiveDealerIdForTenant(session.tenantId);
  if (!dealerId) return NextResponse.json({ error: "No active Dealer ID" }, { status: 400 });

  const { id } = await params;

  const rows = await db
    .select({
      id: schema.activations.id,
      modelName: schema.models.name,
      imei: schema.activations.imei,
      activationDate: schema.activations.activationDate,
      dealerPriceSnapshot: schema.activations.dealerPriceSnapshot,
      customerId: schema.activations.customerId,
      dealerName: schema.dealerIds.name,
    })
    .from(schema.activations)
    .innerJoin(schema.models, eq(schema.models.id, schema.activations.modelId))
    .innerJoin(schema.dealerIds, eq(schema.dealerIds.id, schema.activations.dealerId))
    .where(
      and(
        eq(schema.activations.id, id),
        eq(schema.activations.tenantId, session.tenantId),
        eq(schema.activations.dealerId, dealerId)
      )
    )
    .limit(1);

  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const act = rows[0];

  const tenant = await getTenantById(session.tenantId);

  let customerName: string | null = null;
  let customerPhone: string | null = null;
  let customerCnic: string | null = null;

  if (act.customerId) {
    const cRows = await db
      .select({ name: schema.customers.name, phone: schema.customers.phone, cnic: schema.customers.cnic })
      .from(schema.customers)
      .where(eq(schema.customers.id, act.customerId))
      .limit(1);
    if (cRows[0]) {
      customerName = cRows[0].name;
      customerPhone = cRows[0].phone;
      customerCnic = cRows[0].cnic ?? null;
    }
  }

  const pdf = await buildReceipt({
    activationId: act.id,
    dealerName: act.dealerName,
    businessName: tenant?.businessName ?? "Alhamd Telecom",
    activationDate: act.activationDate,
    modelName: act.modelName,
    imei: act.imei,
    dealerPrice: act.dealerPriceSnapshot,
    customerName,
    customerPhone,
    customerCnic,
  });

  const filename = `receipt-${act.id.slice(0, 8)}.pdf`;
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

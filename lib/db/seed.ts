import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "./schema";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL environment variable is required");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  // Upsert owner tenant
  const existing = await db
    .select()
    .from(schema.dealerTenants)
    .where(eq(schema.dealerTenants.id, "owner"))
    .limit(1);

  if (existing.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const far = "2099-12-31";
    await db.insert(schema.dealerTenants).values({
      id: "owner",
      businessName: "Alhamd Telecom (Owner)",
      ownerEmail: "owner@alhamd.internal",
      planMonths: 999,
      startedAt: today,
      expiresAt: far,
      status: "active",
    });
    console.log("✅ Inserted owner tenant");
  } else {
    console.log("Owner tenant already exists — skipping insert");
  }

  // Backfill tenant_id = 'owner' on all scoped tables where tenant_id is null
  const tables = [
    "dealer_ids",
    "model_price_history",
    "purchases",
    "activations",
    "cross_region_transfers",
    "inter_id_transfers",
    "cr_caught",
    "target_bonus_policies",
    "stock_in_policies",
    "activation_incentive_policies",
    "dealer_incentive_policies",
  ];

  for (const table of tables) {
    const result = await pool.query(
      `UPDATE ${table} SET tenant_id = 'owner' WHERE tenant_id IS NULL`
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`✅ Backfilled ${result.rowCount} rows in ${table}`);
    }
  }

  // Seed sample data only if dealer_ids is empty
  const dealerCount = await db.select().from(schema.dealerIds).limit(1);
  if (dealerCount.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const dealerId = randomUUID();
    await db.insert(schema.dealerIds).values({
      id: dealerId,
      tenantId: "owner",
      name: "Khanewal Main",
      note: "Primary dealer ID",
      isActive: true,
    });

    const sampleModels = [
      { name: "OPPO Reno 12 Pro 12+512", sku: "RENO12PRO-12-512", dealer: 145000, invoice: 158000 },
      { name: "OPPO Reno 12 8+256", sku: "RENO12-8-256", dealer: 95000, invoice: 104000 },
      { name: "OPPO A78 8+256", sku: "A78-8-256", dealer: 52000, invoice: 56500 },
      { name: "OPPO A60 8+128", sku: "A60-8-128", dealer: 38000, invoice: 41500 },
      { name: "OPPO Find X8 16+512", sku: "FINDX8-16-512", dealer: 295000, invoice: 320000 },
    ];

    for (const m of sampleModels) {
      const modelId = randomUUID();
      await db.insert(schema.models).values({ id: modelId, name: m.name, sku: m.sku, isActive: true });
      await db.insert(schema.modelPriceHistory).values({
        id: randomUUID(),
        tenantId: "owner",
        modelId,
        dealerPrice: m.dealer,
        invoicePrice: m.invoice,
        effectiveFrom: today,
        effectiveTo: null,
      });
    }
    console.log("✅ Seeded sample dealer + models");
  }

  await pool.end();
  console.log("✅ Seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

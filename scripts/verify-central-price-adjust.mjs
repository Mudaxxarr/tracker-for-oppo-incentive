import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db/client.ts";
import { updateModelPrice } from "../lib/db/queries/models.ts";
import { drainRebateJobs } from "../lib/db/queries/rebate-jobs.ts";
import { listRebatesForDealer } from "../lib/db/queries/rebates.ts";

const OWNER = "owner";
const PFX = "zz_test_cpa_";
const now = new Date().toISOString();
const today = now.slice(0, 10);
const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const otherTenant = PFX + randomUUID();
const otherDealer = PFX + randomUUID();
const ownerDealer = PFX + randomUUID();
const modelId = PFX + randomUUID();

async function seed() {
  await db.insert(schema.dealerTenants).values({
    id: otherTenant, businessName: "CPA Test Dealer", ownerEmail: otherTenant + "@test.local",
    planMonths: 12, startedAt: today, expiresAt: today, status: "active", createdAt: now,
  });
  await db.insert(schema.dealerIds).values([
    { id: ownerDealer, tenantId: OWNER, name: "CPA Owner Dealer", isActive: true, createdAt: now },
    { id: otherDealer, tenantId: otherTenant, name: "CPA Other Dealer", isActive: true, createdAt: now },
  ]);
  await db.insert(schema.models).values({ id: modelId, name: PFX + "Model", isActive: true, createdAt: now });
  // Owner central price = 100 as of yesterday
  await db.insert(schema.modelPriceHistory).values({
    id: randomUUID(), tenantId: OWNER, modelId, dealerPrice: 100, invoicePrice: 100,
    effectiveFrom: yest, effectiveTo: null, createdAt: now,
  });
  // Other-tenant dealer bought 5 units yesterday (stock under its OWN tenant)
  await db.insert(schema.purchases).values({
    id: randomUUID(), tenantId: otherTenant, dealerId: otherDealer, modelId, quantity: 5,
    unitDealerPrice: 100, unitInvoicePrice: 100, purchaseDate: yest,
    source: "REGULAR", reviewStatus: "active", createdAt: now,
  });
}

async function cleanup() {
  await db.delete(schema.rebateJobs).where(eq(schema.rebateJobs.modelId, modelId));
  await db.delete(schema.rebates).where(eq(schema.rebates.modelId, modelId));
  await db.delete(schema.purchases).where(eq(schema.purchases.modelId, modelId));
  await db.delete(schema.modelPriceHistory).where(eq(schema.modelPriceHistory.modelId, modelId));
  await db.delete(schema.dealerIds).where(eq(schema.dealerIds.id, otherDealer));
  await db.delete(schema.dealerIds).where(eq(schema.dealerIds.id, ownerDealer));
  await db.delete(schema.models).where(eq(schema.models.id, modelId));
  await db.delete(schema.dealerTenants).where(eq(schema.dealerTenants.id, otherTenant));
}

let failed = false;
try {
  await seed();
  // Owner drops the central price 100 -> 80, effective today
  await updateModelPrice(OWNER, { modelId, dealerPrice: 80, invoicePrice: 80, effectiveFrom: today });
  await drainRebateJobs();

  const rebates = await listRebatesForDealer(OWNER, otherDealer);
  const hit = rebates.find((r) => r.modelId === modelId);
  if (!hit) {
    console.error("❌ FAIL: non-owner dealer got NO rebate after owner price drop");
    failed = true;
  } else if (hit.rebatePerUnit !== 20 || hit.eligibleQty !== 5 || hit.totalRebateAmount !== 100) {
    console.error("❌ FAIL: wrong rebate", hit);
    failed = true;
  } else {
    console.log("✅ PASS: non-owner dealer rebate =", hit.totalRebateAmount, "(5 × 20)");
  }
} catch (e) {
  console.error("❌ ERROR", e);
  failed = true;
} finally {
  await cleanup();
  await db.$client.end?.();
}
process.exit(failed ? 1 : 0);

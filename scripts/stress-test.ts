/* eslint-disable no-console */
/**
 * Stress test the OPPO tracker app.
 *
 * Generates a realistic-but-large dataset, then times:
 *  - bulk insert throughput
 *  - calculateIncentives on the full dataset
 *  - last-six-months engine roll-up
 *  - PDF and Excel export sizes
 *  - HTTP page response times
 *
 * Usage:
 *   npm run stress
 *
 * Env vars:
 *   STRESS_DEALERS    default 3
 *   STRESS_PURCHASES  default 2000
 *   STRESS_ACTIVATIONS default 5000
 *   STRESS_POLICIES   default 50
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import * as schema from "../lib/db/schema";

function resolveDbPath(): string {
  // Always use a dedicated stress DB so we never pollute the live DB.
  // Override with STRESS_DB=<path> to point elsewhere.
  const raw = process.env.STRESS_DB ?? "./data/oppo-tracker.stress.db";
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

const N_DEALERS = Number(process.env.STRESS_DEALERS ?? 3);
const N_PURCHASES = Number(process.env.STRESS_PURCHASES ?? 2000);
const N_ACTIVATIONS = Number(process.env.STRESS_ACTIVATIONS ?? 5000);
const N_POLICIES = Number(process.env.STRESS_POLICIES ?? 50);

const MODELS_FIXTURE = [
  { name: "OPPO Reno 12 Pro 12+512", dealer: 145000, invoice: 158000 },
  { name: "OPPO Reno 12 8+256", dealer: 95000, invoice: 104000 },
  { name: "OPPO A78 8+256", dealer: 52000, invoice: 56500 },
  { name: "OPPO A60 8+128", dealer: 38000, invoice: 41500 },
  { name: "OPPO Find X8 16+512", dealer: 295000, invoice: 320000 },
  { name: "OPPO A18 4+128", dealer: 28000, invoice: 30500 },
  { name: "OPPO A38 4+128", dealer: 32000, invoice: 35000 },
  { name: "OPPO Reno 11 8+256", dealer: 78000, invoice: 85000 },
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function randomImei(): string {
  // 15 random digits — uniqueness is checked by inserter; collisions skipped
  return Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join("");
}

async function main() {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  // Fresh DB every run for repeatable benchmarks. Uncomment the next line to keep state across runs.
  if (fs.existsSync(dbPath) && !process.env.STRESS_KEEP) fs.rmSync(dbPath);
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Apply migrations so the stress DB has the same schema as prod.
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const migDb = drizzle(sqlite);
  migrate(migDb, { migrationsFolder: path.resolve(process.cwd(), "lib/db/migrations") });

  const db = drizzle(sqlite, { schema });

  console.log(`\n=== STRESS TEST ===`);
  console.log(`db: ${dbPath}`);
  console.log(`dealers=${N_DEALERS} purchases=${N_PURCHASES} activations=${N_ACTIVATIONS} policies=${N_POLICIES}\n`);

  const t0 = performance.now();

  // ------- Create dealers -------
  const dealerIds: string[] = [];
  for (let i = 0; i < N_DEALERS; i++) {
    const id = randomUUID();
    dealerIds.push(id);
    await db.insert(schema.dealerIds).values({
      id,
      name: `Dealer ${i + 1}`,
      isActive: true,
    });
  }
  console.log(`Created ${dealerIds.length} dealer IDs.`);

  // ------- Create models with price history -------
  const modelIds: string[] = [];
  for (const m of MODELS_FIXTURE) {
    const id = randomUUID();
    modelIds.push(id);
    await db.insert(schema.models).values({
      id,
      name: m.name,
      isActive: true,
    });
    // Add 2-3 price history rows per model (simulate price changes).
    const oldPriceDate = dateOffsetDays(120);
    const midPriceDate = dateOffsetDays(60);
    await db.insert(schema.modelPriceHistory).values({
      id: randomUUID(),
      modelId: id,
      dealerPrice: Math.round(m.dealer * 0.95),
      invoicePrice: Math.round(m.invoice * 0.95),
      effectiveFrom: oldPriceDate,
      effectiveTo: midPriceDate,
    });
    await db.insert(schema.modelPriceHistory).values({
      id: randomUUID(),
      modelId: id,
      dealerPrice: Math.round(m.dealer * 0.98),
      invoicePrice: Math.round(m.invoice * 0.98),
      effectiveFrom: midPriceDate,
      effectiveTo: dateOffsetDays(15),
    });
    await db.insert(schema.modelPriceHistory).values({
      id: randomUUID(),
      modelId: id,
      dealerPrice: m.dealer,
      invoicePrice: m.invoice,
      effectiveFrom: dateOffsetDays(15),
      effectiveTo: null,
    });
  }
  console.log(`Created ${modelIds.length} models with price history.`);

  // ------- Bulk insert purchases (using transaction for speed) -------
  const tPurchasesStart = performance.now();
  const purchaseInsert = sqlite.prepare(`
    INSERT INTO purchases (id, dealer_id, model_id, quantity, unit_dealer_price, unit_invoice_price, purchase_date, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `);
  const insertManyPurchases = sqlite.transaction((rows: Array<unknown[]>) => {
    for (const r of rows) {
      purchaseInsert.run(...r);
    }
  });
  const purchaseRows: Array<unknown[]> = [];
  for (let i = 0; i < N_PURCHASES; i++) {
    const dealer = rand(dealerIds);
    const model = rand(modelIds);
    const fixture = MODELS_FIXTURE[modelIds.indexOf(model)];
    const qty = 1 + Math.floor(Math.random() * 10);
    const daysAgo = Math.floor(Math.random() * 180);
    const date = dateOffsetDays(daysAgo);
    const isCross = Math.random() < 0.1;
    purchaseRows.push([
      randomUUID(),
      dealer,
      model,
      qty,
      fixture.dealer,
      fixture.invoice,
      date,
      isCross ? "CROSS_REGION_TRANSFER_IN" : "REGULAR",
    ]);
  }
  insertManyPurchases(purchaseRows);
  const tPurchasesEnd = performance.now();
  console.log(
    `Inserted ${N_PURCHASES} purchases in ${(tPurchasesEnd - tPurchasesStart).toFixed(0)}ms (${(
      N_PURCHASES /
      ((tPurchasesEnd - tPurchasesStart) / 1000)
    ).toFixed(0)}/s)`
  );

  // ------- Bulk insert activations -------
  const tActStart = performance.now();
  const activationInsert = sqlite.prepare(`
    INSERT INTO activations (id, dealer_id, model_id, imei, activation_date, dealer_price_snapshot, is_cross_region, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `);
  const insertManyActivations = sqlite.transaction((rows: Array<unknown[]>) => {
    for (const r of rows) {
      try {
        activationInsert.run(...r);
      } catch {
        // unique IMEI collision — skip
      }
    }
  });
  const activationRows: Array<unknown[]> = [];
  // Look up the dealer price effective on each random date.
  const priceByModel = new Map<string, Array<{ start: string; end: string | null; price: number }>>();
  const allPrices = await db.select().from(schema.modelPriceHistory);
  for (const row of allPrices) {
    if (!priceByModel.has(row.modelId)) priceByModel.set(row.modelId, []);
    priceByModel
      .get(row.modelId)!
      .push({ start: row.effectiveFrom, end: row.effectiveTo, price: row.dealerPrice });
  }
  function priceOnDate(modelId: string, date: string): number {
    const list = priceByModel.get(modelId) ?? [];
    for (const p of list) {
      if (p.start <= date && (p.end == null || p.end > date)) return p.price;
    }
    return list.at(-1)?.price ?? 100000;
  }
  for (let i = 0; i < N_ACTIVATIONS; i++) {
    const dealer = rand(dealerIds);
    const model = rand(modelIds);
    const daysAgo = Math.floor(Math.random() * 180);
    const date = dateOffsetDays(daysAgo);
    activationRows.push([
      randomUUID(),
      dealer,
      model,
      randomImei(),
      date,
      priceOnDate(model, date),
      Math.random() < 0.05 ? 1 : 0,
    ]);
  }
  insertManyActivations(activationRows);
  const tActEnd = performance.now();
  console.log(
    `Inserted ${N_ACTIVATIONS} activations in ${(tActEnd - tActStart).toFixed(0)}ms (${(
      N_ACTIVATIONS /
      ((tActEnd - tActStart) / 1000)
    ).toFixed(0)}/s)`
  );

  // ------- Insert policies -------
  const tPolStart = performance.now();
  // Target bonus per dealer per recent month
  const months = [0, 1, 2, 3, 4].map((off) => {
    const d = new Date();
    d.setMonth(d.getMonth() - off);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { start, end };
  });
  for (const dealer of dealerIds) {
    for (const m of months) {
      await db.insert(schema.targetBonusPolicies).values({
        id: randomUUID(),
        dealerId: dealer,
        periodStart: m.start,
        periodEnd: m.end,
        targetActivationsQty: 50,
        bonusPercent: 1,
      });
    }
  }
  // Stock-in + activation incentive policies for the current month per dealer for half the models
  const cur = months[0];
  let policyCount = 0;
  for (const dealer of dealerIds) {
    for (let i = 0; i < Math.floor(modelIds.length / 2) && policyCount < N_POLICIES; i++) {
      await db.insert(schema.stockInPolicies).values({
        id: randomUUID(),
        dealerId: dealer,
        modelId: modelIds[i],
        periodStart: cur.start,
        periodEnd: cur.end,
        perUnitAmount: 1000,
        minQty: null,
      });
      await db.insert(schema.activationIncentivePolicies).values({
        id: randomUUID(),
        dealerId: dealer,
        modelId: modelIds[i],
        periodStart: cur.start,
        periodEnd: cur.end,
        perUnitAmount: 500,
        targetQty: null,
      });
      policyCount += 2;
    }
    await db.insert(schema.dealerIncentivePolicies).values({
      id: randomUUID(),
      dealerId: dealer,
      periodStart: cur.start,
      periodEnd: cur.end,
      targetTotalActivations: 100,
      perUnitAmount: 200,
    });
  }
  const tPolEnd = performance.now();
  console.log(`Inserted policies in ${(tPolEnd - tPolStart).toFixed(0)}ms`);

  // ------- Engine timing (load directly via DB; skip the server-only guard) -------
  const { calculateIncentives } = await import("../lib/incentive-engine");
  const dealer = dealerIds[0];

  async function loadAndRun(periodStart: string, periodEnd: string) {
    const [
      models,
      activations,
      purchases,
      targetBonusPolicies,
      stockInPolicies,
      activationIncentivePolicies,
      dealerIncentivePolicies,
    ] = await Promise.all([
      db.select().from(schema.models),
      db.select().from(schema.activations).where(eq(schema.activations.dealerId, dealer)),
      db.select().from(schema.purchases).where(eq(schema.purchases.dealerId, dealer)),
      db.select().from(schema.targetBonusPolicies).where(eq(schema.targetBonusPolicies.dealerId, dealer)),
      db.select().from(schema.stockInPolicies).where(eq(schema.stockInPolicies.dealerId, dealer)),
      db.select().from(schema.activationIncentivePolicies).where(eq(schema.activationIncentivePolicies.dealerId, dealer)),
      db.select().from(schema.dealerIncentivePolicies).where(eq(schema.dealerIncentivePolicies.dealerId, dealer)),
    ]);
    return calculateIncentives({
      dealerId: dealer,
      periodStart,
      periodEnd,
      baseIncentivePercent: 4,
      models: models.map((m) => ({ id: m.id, name: m.name })),
      activations: activations.map((a) => ({
        id: a.id,
        modelId: a.modelId,
        activationDate: a.activationDate,
        dealerPriceSnapshot: a.dealerPriceSnapshot,
        isCrossRegion: a.isCrossRegion,
      })),
      purchases: purchases.map((p) => ({
        id: p.id,
        modelId: p.modelId,
        quantity: p.quantity,
        unitDealerPrice: p.unitDealerPrice,
        purchaseDate: p.purchaseDate,
        source: p.source as "REGULAR" | "CROSS_REGION_TRANSFER_IN",
      })),
      targetBonusPolicies,
      stockInPolicies: stockInPolicies.map((p) => ({
        id: p.id,
        modelId: p.modelId,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        perUnitAmount: p.perUnitAmount,
        minQty: p.minQty,
      })),
      activationIncentivePolicies: activationIncentivePolicies.map((p) => ({
        id: p.id,
        modelId: p.modelId,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        perUnitAmount: p.perUnitAmount,
        targetQty: p.targetQty,
      })),
      dealerIncentivePolicies,
    });
  }

  console.log(`\n=== ENGINE TIMINGS (Dealer ${dealer.slice(0, 8)}) ===`);
  for (let trial = 1; trial <= 3; trial++) {
    const tStart = performance.now();
    const report = await loadAndRun(cur.start, cur.end);
    const tEnd = performance.now();
    console.log(
      `Trial ${trial}: ${(tEnd - tStart).toFixed(1)}ms — ${report.totalActivations} activations, grand total ${report.totals.grandTotal}`
    );
  }

  // 6-month roll-up
  const t6Start = performance.now();
  for (const m of months) {
    await loadAndRun(m.start, m.end);
  }
  const t6End = performance.now();
  console.log(`6-month roll-up: ${(t6End - t6Start).toFixed(1)}ms (${months.length} months)`);

  // ------- Export timings -------
  const { buildExcel } = await import("../lib/export/report-excel");
  const { buildPDF } = await import("../lib/export/report-pdf");
  const lastReport = await loadAndRun(cur.start, cur.end);
  const tXlsxStart = performance.now();
  const xlsx = await buildExcel(lastReport, "Stress Test");
  const tXlsxEnd = performance.now();
  console.log(`Excel: ${(tXlsxEnd - tXlsxStart).toFixed(1)}ms (${xlsx.length} bytes)`);
  const tPdfStart = performance.now();
  const pdf = await buildPDF(lastReport, "Stress Test");
  const tPdfEnd = performance.now();
  console.log(`PDF: ${(tPdfEnd - tPdfStart).toFixed(1)}ms (${pdf.length} bytes)`);

  console.log(`\nTotal time: ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

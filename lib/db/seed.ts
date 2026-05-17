import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import * as schema from "./schema";

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "./data/oppo-tracker.db";
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

async function main() {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  // Skip if dealer already exists.
  const existing = await db.select().from(schema.dealerIds).limit(1);
  if (existing.length > 0) {
    console.log("Database already seeded — skipping.");
    sqlite.close();
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const dealerId = randomUUID();
  await db.insert(schema.dealerIds).values({
    id: dealerId,
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
    await db.insert(schema.models).values({
      id: modelId,
      name: m.name,
      sku: m.sku,
      isActive: true,
    });
    await db.insert(schema.modelPriceHistory).values({
      id: randomUUID(),
      modelId,
      dealerPrice: m.dealer,
      invoicePrice: m.invoice,
      effectiveFrom: today,
      effectiveTo: null,
    });
  }

  // Sanity check
  const dealerCount = await db.select().from(schema.dealerIds);
  const modelCount = await db.select().from(schema.models);
  console.log(
    `✅ Seeded ${dealerCount.length} dealer ID(s), ${modelCount.length} models.`
  );

  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

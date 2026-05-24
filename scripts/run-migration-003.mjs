import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim().replace(/^'|'$/g, "").replace(/^"|"$/g, "");
  process.env[key] = value;
}

const pg = require("pg");
const { Client } = pg;

const sqlPath = join(__dirname, "../lib/db/migrations/0003_cr_caught_status.sql");
const sql = readFileSync(sqlPath, "utf-8");
const statements = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);

const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();
console.log("Connected. Running", statements.length, "statement(s)...");

let ok = 0;
let skipped = 0;
for (const stmt of statements) {
  try {
    await client.query(stmt);
    ok++;
    console.log("✓", stmt.slice(0, 80).replace(/\n/g, " "));
  } catch (err) {
    if (err.code === "42701" || err.code === "42P07") {
      skipped++;
      console.log("→ skipped (already exists):", stmt.slice(0, 80).replace(/\n/g, " "));
    } else {
      console.error("✗ FAILED:", stmt.slice(0, 120));
      console.error("  Error:", err.message);
    }
  }
}

await client.end();
console.log(`\nDone: ${ok} applied, ${skipped} skipped.`);

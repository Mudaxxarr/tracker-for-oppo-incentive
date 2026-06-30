import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const envContent = readFileSync(join(__dirname, "../.env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
  process.env[key] = value;
}

const { Client } = require("pg");
const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

try {
  await client.query(`ALTER TABLE dealer_tenants ADD COLUMN IF NOT EXISTS feature_trials TEXT NOT NULL DEFAULT '{}'`);
  console.log("✅ feature_trials column added (or already existed)");
} catch (err) {
  console.error("✗ Migration failed:", err.message);
} finally {
  await client.end();
}

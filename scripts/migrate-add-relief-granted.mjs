/**
 * Audit finding #7 — company relief / "Achieved" override.
 *
 * The company sometimes posts a policy to a dealer even though the target was not
 * met. This adds a per-policy `relief_granted` flag across all five policy tables.
 * When set, the engine forces that policy's gate to pass — but the reward still
 * computes on ACTUAL activity, so the dealer is paid for what they really did.
 *
 * Defaults to false everywhere, so nothing changes until the owner flips a policy.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import pg from "pg";

const url = process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL environment variable is required");

const TABLES = [
  "target_bonus_policies",
  "stock_in_policies",
  "activation_incentive_policies",
  "dealer_incentive_policies",
  "combined_stock_in_policies",
];

const { Pool } = pg;
const pool = new Pool({ connectionString: url });

for (const t of TABLES) {
  await pool.query(`
    ALTER TABLE ${t}
      ADD COLUMN IF NOT EXISTS relief_granted BOOLEAN NOT NULL DEFAULT FALSE
  `);
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE relief_granted)::int AS relieved FROM ${t}`
  );
  console.log(`  ${t.padEnd(32)} ${rows[0].total} policies, ${rows[0].relieved} relieved`);
}

await pool.end();
console.log("✓ relief_granted migration complete");

/**
 * Audit finding #4 — per-ID base incentive %.
 *
 * Adds `base_percent_override` to dealer_ids. Nullable, so every existing ID keeps
 * falling back to the global constant and nothing changes until the owner sets a
 * value (typically 3 on wholesale IDs, leaving retail on the global 4).
 *
 * Note for the owner: setting an override changes PAST figures for that ID too,
 * because reports recompute from the current percentage. That is intended — the
 * ID was always meant to be at that rate.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import pg from "pg";

const url = process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL environment variable is required");

const { Pool } = pg;
const pool = new Pool({ connectionString: url });

await pool.query(`
  ALTER TABLE dealer_ids
    ADD COLUMN IF NOT EXISTS base_percent_override REAL
`);

const { rows } = await pool.query(`
  SELECT COUNT(*)::int AS total,
         COUNT(base_percent_override)::int AS overridden
    FROM dealer_ids
`);
console.log(
  `dealer_ids: ${rows[0].total} IDs, ${rows[0].overridden} with an override (rest use the global base %)`
);

await pool.end();
console.log("✓ base_percent_override migration complete");

/**
 * Audit Phase 8 — hidden "favour" ID.
 *
 * Adds `is_hidden` to dealer_ids. A hidden ID is used to park stock for an outside
 * dealer as a favour: it disappears from the ID switcher, dashboards and reports,
 * but stays a valid inter-ID transfer endpoint in both directions, and remains
 * visible on the IDs management page so it can be un-hidden.
 *
 * Defaults to false, so no existing ID changes.
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
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE
`);

const { rows } = await pool.query(
  `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_hidden)::int AS hidden FROM dealer_ids`
);
console.log(`dealer_ids: ${rows[0].total} IDs, ${rows[0].hidden} hidden`);

await pool.end();
console.log("✓ is_hidden migration complete");

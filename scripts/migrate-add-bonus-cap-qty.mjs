/**
 * Audit finding #6 — target-bonus activation cap.
 *
 * Adds `bonus_cap_qty` to target_bonus_policies. Nullable, so every existing policy
 * stays uncapped and keeps paying the bonus on every activation exactly as before.
 * The owner opts a policy into the cap by setting a value.
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
  ALTER TABLE target_bonus_policies
    ADD COLUMN IF NOT EXISTS bonus_cap_qty INTEGER
`);

const { rows } = await pool.query(`
  SELECT COUNT(*)::int AS total,
         COUNT(bonus_cap_qty)::int AS capped
    FROM target_bonus_policies
`);
console.log(
  `target_bonus_policies: ${rows[0].total} policies, ${rows[0].capped} capped (rest uncapped — unchanged behaviour)`
);

await pool.end();
console.log("✓ bonus_cap_qty migration complete");

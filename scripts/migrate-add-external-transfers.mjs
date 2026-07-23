/**
 * External Transfer — dealer stock movement to/from an out-of-system dealer.
 *
 * Creates the external_transfers table. Pure physical-stock movement: the counterpart
 * is a text label, and this never touches the incentive engine. Idempotent.
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
  CREATE TABLE IF NOT EXISTS external_transfers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES dealer_tenants(id),
    dealer_id TEXT NOT NULL REFERENCES dealer_ids(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    direction TEXT NOT NULL,
    transfer_date TEXT NOT NULL,
    counterpart_name TEXT NOT NULL,
    counterpart_city TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT now()::text
  )
`);

await pool.query(`CREATE INDEX IF NOT EXISTS ext_by_dealer ON external_transfers (tenant_id, dealer_id, transfer_date)`);
await pool.query(`CREATE INDEX IF NOT EXISTS ext_by_model ON external_transfers (tenant_id, dealer_id, model_id)`);

const [{ c }] = (await pool.query(`SELECT COUNT(*)::int c FROM external_transfers`)).rows;
console.log(`external_transfers ready (${c} rows)`);

await pool.end();
console.log("✓ external_transfers migration complete");

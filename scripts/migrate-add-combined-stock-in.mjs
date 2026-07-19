import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import pg from "pg";

const url = process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL environment variable is required");

const { Pool } = pg;
const pool = new Pool({ connectionString: url });

await pool.query(`
  CREATE TABLE IF NOT EXISTS combined_stock_in_policies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES dealer_tenants(id),
    dealer_id TEXT NOT NULL REFERENCES dealer_ids(id) ON DELETE CASCADE,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    target_qty INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT now()::text
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS combined_stock_in_policy_models (
    id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL REFERENCES combined_stock_in_policies(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
    per_unit_amount REAL NOT NULL
  )
`);

await pool.query(`CREATE INDEX IF NOT EXISTS csip_by_dealer ON combined_stock_in_policies(tenant_id, dealer_id, period_start)`);
await pool.query(`CREATE INDEX IF NOT EXISTS csipm_by_policy ON combined_stock_in_policy_models(policy_id)`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS csipm_uniq_policy_model ON combined_stock_in_policy_models(policy_id, model_id)`);

// RLS: enable + explicit deny-public, matching every other table (see migration 0012).
await pool.query(`ALTER TABLE combined_stock_in_policies ENABLE ROW LEVEL SECURITY`);
await pool.query(`ALTER TABLE combined_stock_in_policy_models ENABLE ROW LEVEL SECURITY`);
await pool.query(`DROP POLICY IF EXISTS deny_public_api ON combined_stock_in_policies`);
await pool.query(`CREATE POLICY deny_public_api ON combined_stock_in_policies FOR ALL TO anon, authenticated USING (false)`);
await pool.query(`DROP POLICY IF EXISTS deny_public_api ON combined_stock_in_policy_models`);
await pool.query(`CREATE POLICY deny_public_api ON combined_stock_in_policy_models FOR ALL TO anon, authenticated USING (false)`);

console.log("✅ combined_stock_in_policies + combined_stock_in_policy_models created (with RLS deny-public)");
await pool.end();

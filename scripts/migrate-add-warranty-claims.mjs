import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS warranty_claims (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES dealer_tenants(id) ON DELETE CASCADE,
      dealer_id TEXT NOT NULL REFERENCES dealer_ids(id) ON DELETE CASCADE,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      activation_id TEXT REFERENCES activations(id) ON DELETE SET NULL,
      model_id TEXT NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
      issue_desc TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (now()::text),
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS warranty_by_dealer ON warranty_claims (tenant_id, dealer_id, created_at);
    CREATE INDEX IF NOT EXISTS warranty_by_status ON warranty_claims (tenant_id, status, created_at);
  `);
  console.log("Migration complete: warranty_claims table created");
} finally {
  await pool.end();
}

import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES dealer_tenants(id) ON DELETE CASCADE,
      dealer_id TEXT NOT NULL REFERENCES dealer_ids(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      cnic TEXT,
      created_at TEXT NOT NULL DEFAULT (now()::text)
    );
    CREATE INDEX IF NOT EXISTS customers_by_dealer ON customers (tenant_id, dealer_id, created_at);
    CREATE INDEX IF NOT EXISTS customers_by_phone ON customers (tenant_id, dealer_id, phone);

    ALTER TABLE activations
      ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;
  `);
  console.log("Migration complete: customers table created, customer_id added to activations");
} finally {
  await pool.end();
}

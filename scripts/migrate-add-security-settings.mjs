import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

await pool.query(`
  ALTER TABLE dealer_tenants
    ADD COLUMN IF NOT EXISTS backdate_days INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS purchase_approval_threshold INTEGER
`);

await pool.query(`
  ALTER TABLE purchases
    ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'active'
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS owner_alerts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES dealer_tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    dealer_id TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL DEFAULT (now()::text)
  )
`);

await pool.query(`
  CREATE INDEX IF NOT EXISTS owner_alerts_by_tenant
    ON owner_alerts (tenant_id, is_read, created_at)
`);

console.log("Migration complete: backdate_days, purchase_approval_threshold, review_status, owner_alerts");
await pool.end();

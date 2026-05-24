import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://postgres.tistjyrldecrdnljctid:giJ5nvgiR0Gemsjm@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS dealer_daily_backups (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES dealer_tenants(id) ON DELETE CASCADE,
    backup_date TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT now()::text,
    UNIQUE(tenant_id, backup_date)
  )
`);
await pool.query(`
  CREATE INDEX IF NOT EXISTS dealer_daily_backups_by_tenant
  ON dealer_daily_backups(tenant_id, backup_date DESC)
`);

console.log("✅ dealer_daily_backups table created");
await pool.end();

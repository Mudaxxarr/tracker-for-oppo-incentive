import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://postgres.tistjyrldecrdnljctid:giJ5nvgiR0Gemsjm@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
});

await pool.query(`
  ALTER TABLE dealer_tenants
  ADD COLUMN IF NOT EXISTS features TEXT NOT NULL DEFAULT '{}'
`);

console.log("Migration complete: dealer_tenants.features column added");
await pool.end();

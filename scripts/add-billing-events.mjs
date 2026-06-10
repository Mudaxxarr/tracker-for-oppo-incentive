import pg from "pg";

const url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL not set — run with: POSTGRES_URL=\"...\" node scripts/add-billing-events.mjs");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_events (
      id          text    PRIMARY KEY,
      tenant_id   text    NOT NULL REFERENCES dealer_tenants(id) ON DELETE CASCADE,
      amount      real    NOT NULL,
      paid_at     text    NOT NULL,
      note        text,
      recorded_by text,
      months_added integer,
      created_at  text    NOT NULL DEFAULT now()::text
    )
  `);
  console.log("✓ billing_events table created (or already exists)");
} finally {
  await pool.end();
}

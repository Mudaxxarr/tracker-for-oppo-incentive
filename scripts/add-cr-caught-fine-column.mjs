import pg from "pg";

const url = process.env.POSTGRES_URL;
if (!url) { console.error("POSTGRES_URL not set"); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("ALTER TABLE cr_caught ADD COLUMN IF NOT EXISTS fine_amount real DEFAULT 0");
  console.log("✓ fine_amount column added to cr_caught (or already exists)");
} finally {
  await client.end();
}

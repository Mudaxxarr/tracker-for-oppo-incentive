import pg from "pg";

const url = process.env.POSTGRES_URL;
if (!url) { console.error("POSTGRES_URL not set"); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("ALTER TABLE owner_alerts ADD COLUMN IF NOT EXISTS payload text");
  console.log("✓ payload column added to owner_alerts (or already exists)");
} finally {
  await client.end();
}

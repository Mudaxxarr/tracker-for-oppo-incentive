import pg from "pg";

const url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL not set — run with: POSTGRES_URL=\"...\" node scripts/migrations/add-dealer-shop-name.mjs");
  process.exit(1);
}

// TLS verification on by default; set PGSSL_INSECURE=1 only if your pooler
// uses a cert your trust store can't verify.
const ssl =
  process.env.PGSSL_INSECURE === "1" ? { rejectUnauthorized: false } : true;
const pool = new pg.Pool({ connectionString: url, ssl });

try {
  await pool.query(`ALTER TABLE dealer_ids ADD COLUMN IF NOT EXISTS shop_name text;`);
  console.log("OK: dealer_ids.shop_name added (or already present).");
} finally {
  await pool.end();
}

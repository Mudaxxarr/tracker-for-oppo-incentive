import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    ALTER TABLE dealer_tenants
      ADD COLUMN IF NOT EXISTS monthly_fee REAL;
  `);
  console.log("Migration complete: monthly_fee added to dealer_tenants");
} finally {
  await pool.end();
}

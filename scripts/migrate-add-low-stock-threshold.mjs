import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    ALTER TABLE models
      ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER;
  `);
  console.log("Migration complete: low_stock_threshold added to models");
} finally {
  await pool.end();
}

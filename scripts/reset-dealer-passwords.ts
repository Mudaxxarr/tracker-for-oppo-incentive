/* eslint-disable no-console */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env.local") });

import { Pool } from "pg";
import bcrypt from "bcryptjs";

const NEW_PASSWORD = "12345678";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL not found in .env.local");

  const pool = new Pool({ connectionString: url });

  const hash = await bcrypt.hash(NEW_PASSWORD, 12);
  console.log("Hashed new password.");

  const result = await pool.query(
    `UPDATE dealer_users SET password_hash = $1 RETURNING id, email`,
    [hash],
  );

  console.log(`Updated ${result.rowCount} dealer user(s):`);
  for (const row of result.rows) {
    console.log(`  • ${row.email} (${row.id})`);
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

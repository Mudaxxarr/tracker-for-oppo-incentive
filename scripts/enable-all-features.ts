/* eslint-disable no-console */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env.local") });

import { Pool } from "pg";

const ALL_FEATURES = {
  activations: true,
  purchases: true,
  inventory: true,
  ids: true,
  models: true,
  cross_region: true,
  policies: true,
  reports: true,
  settings: true,
  team: true,
  activity: true,
};

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL not found in .env.local");

  const pool = new Pool({ connectionString: url });

  const result = await pool.query(
    `UPDATE dealer_tenants
     SET features = $1
     WHERE id != 'owner'
     RETURNING id, business_name`,
    [JSON.stringify(ALL_FEATURES)],
  );

  console.log(`Enabled all features for ${result.rowCount} tenant(s):`);
  for (const row of result.rows) {
    console.log(`  • ${row.business_name} (${row.id})`);
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL environment variable is required");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  const migrationsFolder = path.resolve(process.cwd(), "lib/db/migrations");

  console.log("Running migrations →", migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("✅ Migrations applied");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

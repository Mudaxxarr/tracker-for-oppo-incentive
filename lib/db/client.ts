import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type AppDb = NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __oppoDb: AppDb | undefined;
  // eslint-disable-next-line no-var
  var __oppoPool: Pool | undefined;
}

function createPool(): Pool {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL environment variable is required");
  return new Pool({ connectionString: url, max: 10 });
}

const pool: Pool = globalThis.__oppoPool ?? createPool();
globalThis.__oppoPool = pool;

export const db: AppDb = globalThis.__oppoDb ?? drizzle(pool, { schema });
globalThis.__oppoDb = db;

export { schema };

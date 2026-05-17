import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

export type AppDb = BetterSQLite3Database<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __oppoDb: AppDb | undefined;
}

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "./data/oppo-tracker.db";
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function openDb(): AppDb {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db: AppDb = globalThis.__oppoDb ?? openDb();
globalThis.__oppoDb = db;

export { schema };

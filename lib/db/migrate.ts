import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "./data/oppo-tracker.db";
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

const migrationsFolder = path.resolve(process.cwd(), "lib/db/migrations");
console.log("Running migrations from", migrationsFolder, "→", dbPath);
migrate(db, { migrationsFolder });
console.log("✅ Migrations applied");
sqlite.close();

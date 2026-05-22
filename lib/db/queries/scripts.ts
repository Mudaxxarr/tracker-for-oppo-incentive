import "server-only";
import { db, schema } from "../client";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function listActiveScripts() {
  return db
    .select()
    .from(schema.scripts)
    .where(eq(schema.scripts.isActive, true))
    .orderBy(asc(schema.scripts.sortOrder), asc(schema.scripts.title));
}

export async function listAllScripts() {
  return db
    .select()
    .from(schema.scripts)
    .orderBy(asc(schema.scripts.sortOrder), asc(schema.scripts.title));
}

export async function getScriptById(id: string) {
  const rows = await db.select().from(schema.scripts).where(eq(schema.scripts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createScript(input: {
  title: string;
  body: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.scripts).values({
    id,
    title: input.title.trim(),
    body: input.body.trim(),
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  });
  return id;
}

export async function updateScript(
  id: string,
  input: { title?: string; body?: string; sortOrder?: number; isActive?: boolean }
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (input.title !== undefined) set.title = input.title.trim();
  if (input.body !== undefined) set.body = input.body.trim();
  if (input.sortOrder !== undefined) set.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) set.isActive = input.isActive;
  if (Object.keys(set).length === 0) return;
  await db.update(schema.scripts).set(set).where(eq(schema.scripts.id, id));
}

export async function deleteScript(id: string): Promise<void> {
  await db.delete(schema.scripts).where(eq(schema.scripts.id, id));
}

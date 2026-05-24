import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db, schema } from "./db/client";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { SESSION_COOKIE, OWNER_STAFF_SESSION_COOKIE, type StaffRole } from "./constants";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET environment variable is required");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function makeStaffToken(staffId: string, role: StaffRole): string {
  const issued = Date.now().toString();
  const random = crypto.randomBytes(16).toString("hex");
  const body = `${issued}.${staffId}.${role}.${random}`;
  return `${body}.${sign(body)}`;
}

function parseStaffToken(token: string): { staffId: string; role: StaffRole; issuedAt: number } | null {
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [issued, staffId, role, , sig] = parts;
  const body = parts.slice(0, 4).join(".");
  const expected = sign(body);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > SESSION_TTL_MS) return null;
  if (!["so", "accountant"].includes(role)) return null;
  if (!staffId) return null;
  return { staffId, role: role as StaffRole, issuedAt };
}

export async function verifyStaffCredentials(username: string, password: string): Promise<{ id: string; role: StaffRole } | null> {
  const rows = await db.select().from(schema.ownerStaff)
    .where(eq(schema.ownerStaff.username, username.trim().toLowerCase()))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row.isActive) return null;
  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) return null;
  return { id: row.id, role: row.role as StaffRole };
}

export async function startStaffSession(staffId: string, role: StaffRole): Promise<void> {
  const token = makeStaffToken(staffId, role);
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE); // evict any active owner session
  cookieStore.set(OWNER_STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OWNER_STAFF_SESSION_COOKIE);
}

export async function getStaffSession(): Promise<{ staffId: string; role: StaffRole } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(OWNER_STAFF_SESSION_COOKIE)?.value;
  if (!token) return null;
  const parsed = parseStaffToken(token);
  if (!parsed) return null;
  // Verify staff is still active
  const rows = await db.select({ isActive: schema.ownerStaff.isActive }).from(schema.ownerStaff)
    .where(eq(schema.ownerStaff.id, parsed.staffId)).limit(1);
  if (rows.length === 0 || !rows[0].isActive) return null;
  return { staffId: parsed.staffId, role: parsed.role };
}

// ── Management functions ──────────────────────────────────────────────────────

export async function listOwnerStaff() {
  return db.select({ id: schema.ownerStaff.id, username: schema.ownerStaff.username, role: schema.ownerStaff.role, isActive: schema.ownerStaff.isActive, createdAt: schema.ownerStaff.createdAt })
    .from(schema.ownerStaff)
    .orderBy(schema.ownerStaff.createdAt);
}

export async function createOwnerStaff(input: { username: string; password: string; role: StaffRole }): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  const username = input.username.trim().toLowerCase();
  if (!username) return { ok: false, error: "Username is required" };
  const exists = await db.select({ id: schema.ownerStaff.id }).from(schema.ownerStaff).where(eq(schema.ownerStaff.username, username)).limit(1);
  if (exists.length > 0) return { ok: false, error: "Username already taken" };
  const passwordHash = await bcrypt.hash(input.password, 12);
  await db.insert(schema.ownerStaff).values({ id: randomUUID(), username, passwordHash, role: input.role, isActive: true });
  return { ok: true, tempPassword: input.password };
}

export async function resetOwnerStaffPassword(staffId: string): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  const tempPassword = crypto.randomBytes(6).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const result = await db.update(schema.ownerStaff).set({ passwordHash }).where(eq(schema.ownerStaff.id, staffId));
  if (!result) return { ok: false, error: "Staff member not found" };
  return { ok: true, tempPassword };
}

export async function toggleOwnerStaffActive(staffId: string, isActive: boolean): Promise<void> {
  await db.update(schema.ownerStaff).set({ isActive }).where(eq(schema.ownerStaff.id, staffId));
}

export async function deleteOwnerStaff(staffId: string): Promise<void> {
  await db.delete(schema.ownerStaff).where(eq(schema.ownerStaff.id, staffId));
}

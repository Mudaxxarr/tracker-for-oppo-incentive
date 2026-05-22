import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { SESSION_COOKIE, TEAM_SESSION_COOKIE } from "./constants";
import { db, schema } from "./db/client";
import { eq } from "drizzle-orm";

const SESSION_TTL_DAYS = 30;
const APP_PIN_KEY = "app_pin_hash";
const SESSION_INVALIDATED_KEY = "session_invalidated_at";
const TEAM_PIN_KEY = "team_pin_hash";

// ---- PIN brute-force protection (in-process, resets on server restart) ----
const _pinAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_PIN_FAILURES = 10;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function checkPinRateLimit(ip: string): { allowed: boolean; retryAfterSecs?: number } {
  const rec = _pinAttempts.get(ip);
  if (!rec) return { allowed: true };
  if (rec.lockedUntil > Date.now()) {
    return { allowed: false, retryAfterSecs: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }
  return { allowed: true };
}

export function recordPinFailure(ip: string): void {
  const now = Date.now();
  const rec = _pinAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  if (rec.lockedUntil > 0 && rec.lockedUntil <= now) { rec.count = 0; rec.lockedUntil = 0; }
  rec.count += 1;
  if (rec.count >= MAX_PIN_FAILURES) rec.lockedUntil = now + LOCKOUT_MS;
  _pinAttempts.set(ip, rec);
}

export function recordPinSuccess(ip: string): void {
  _pinAttempts.delete(ip);
}

async function getPinHash(): Promise<string> {
  // DB-stored PIN takes precedence (so the user can change it at runtime).
  try {
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, APP_PIN_KEY))
      .limit(1);
    if (rows.length > 0 && rows[0].value) return rows[0].value;
  } catch {
    /* fall through to env */
  }
  const h = process.env.APP_PIN_HASH;
  if (!h) {
    throw new Error("APP_PIN_HASH not set and no PIN stored in app_settings");
  }
  return h;
}

async function getSessionInvalidatedAt(): Promise<number> {
  try {
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, SESSION_INVALIDATED_KEY))
      .limit(1);
    if (rows.length > 0) return Number(rows[0].value) || 0;
  } catch { /* fall through */ }
  return 0;
}

export async function invalidateAllSessions(): Promise<void> {
  const now = Date.now().toString();
  const nowIso = new Date().toISOString();
  const existing = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, SESSION_INVALIDATED_KEY))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(schema.appSettings)
      .set({ value: now, updatedAt: nowIso })
      .where(eq(schema.appSettings.key, SESSION_INVALIDATED_KEY));
  } else {
    await db
      .insert(schema.appSettings)
      .values({ key: SESSION_INVALIDATED_KEY, value: now, updatedAt: nowIso });
  }
}

export async function setPinHash(hash: string): Promise<void> {
  const existing = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, APP_PIN_KEY))
    .limit(1);
  const now = new Date().toISOString();
  if (existing.length > 0) {
    await db
      .update(schema.appSettings)
      .set({ value: hash, updatedAt: now })
      .where(eq(schema.appSettings.key, APP_PIN_KEY));
  } else {
    await db
      .insert(schema.appSettings)
      .values({ key: APP_PIN_KEY, value: hash, updatedAt: now });
  }
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is required but not set");
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function makeToken(): string {
  // payload: timestamp.<random>.<hmac>
  const issued = Date.now().toString();
  const random = crypto.randomBytes(16).toString("hex");
  const body = `${issued}.${random}`;
  return `${body}.${sign(body)}`;
}

function verifyToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issued, random, sig] = parts;
  if (!/^\d+$/.test(issued) || !/^[0-9a-f]+$/i.test(random)) return false;
  const expected = sign(`${issued}.${random}`);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const ageMs = Date.now() - Number(issued);
  if (ageMs < 0 || ageMs > SESSION_TTL_DAYS * 24 * 3600 * 1000) return false;
  return true;
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (!pin || pin.length < 4 || pin.length > 12) return false;
  const hash = await getPinHash();
  return bcrypt.compare(pin, hash);
}

export async function startSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 3600,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  await invalidateAllSessions();
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  if (!verifyToken(token)) return false;
  // Server-side revocation: reject tokens issued before the last invalidation timestamp.
  const invalidatedAt = await getSessionInvalidatedAt();
  if (invalidatedAt > 0) {
    const issued = Number(token.split(".")[0]);
    if (issued <= invalidatedAt) return false;
  }
  return true;
}

/** For the Settings → PIN change flow. Updates `.env.local` is out of scope; we
 *  store the new hash in the app_settings table and prefer it over env. */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

// ── Admin email/password login ────────────────────────────────────────────────

const ADMIN_EMAIL_KEY = "admin_email";
const ADMIN_PASSWORD_HASH_KEY = "admin_password_hash";

async function getAdminSetting(key: string): Promise<string | null> {
  try {
    const rows = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key)).limit(1);
    if (rows.length > 0 && rows[0].value) return rows[0].value;
  } catch { /* fall through */ }
  return null;
}

async function setAdminSetting(key: string, value: string): Promise<void> {
  const existing = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key)).limit(1);
  const now = new Date().toISOString();
  if (existing.length > 0) {
    await db.update(schema.appSettings).set({ value, updatedAt: now }).where(eq(schema.appSettings.key, key));
  } else {
    await db.insert(schema.appSettings).values({ key, value, updatedAt: now });
  }
}

export async function hasAdminCredentials(): Promise<boolean> {
  const email = await getAdminSetting(ADMIN_EMAIL_KEY);
  const hash = await getAdminSetting(ADMIN_PASSWORD_HASH_KEY);
  return !!(email && hash);
}

export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const storedEmail = await getAdminSetting(ADMIN_EMAIL_KEY);
  const storedHash = await getAdminSetting(ADMIN_PASSWORD_HASH_KEY);
  if (!storedEmail || !storedHash) return false;
  if (email.toLowerCase().trim() !== storedEmail.toLowerCase().trim()) return false;
  return bcrypt.compare(password, storedHash);
}

export async function setAdminCredentials(email: string, password: string): Promise<void> {
  const hash = await bcrypt.hash(password, 12);
  await setAdminSetting(ADMIN_EMAIL_KEY, email.toLowerCase().trim());
  await setAdminSetting(ADMIN_PASSWORD_HASH_KEY, hash);
}

// ── Team session ─────────────────────────────────────────────────────────────

async function getTeamPinHash(): Promise<string | null> {
  try {
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, TEAM_PIN_KEY))
      .limit(1);
    if (rows.length > 0 && rows[0].value) return rows[0].value;
  } catch { /* fall through */ }
  return null;
}

export async function setTeamPinHash(hash: string): Promise<void> {
  const existing = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, TEAM_PIN_KEY))
    .limit(1);
  const now = new Date().toISOString();
  if (existing.length > 0) {
    await db
      .update(schema.appSettings)
      .set({ value: hash, updatedAt: now })
      .where(eq(schema.appSettings.key, TEAM_PIN_KEY));
  } else {
    await db
      .insert(schema.appSettings)
      .values({ key: TEAM_PIN_KEY, value: hash, updatedAt: now });
  }
}

export async function verifyTeamPin(pin: string): Promise<boolean> {
  if (!pin || pin.length < 4 || pin.length > 12) return false;
  const hash = await getTeamPinHash();
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

export async function hasTeamPin(): Promise<boolean> {
  return (await getTeamPinHash()) !== null;
}

export async function startTeamSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(TEAM_SESSION_COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 3600,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endTeamSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TEAM_SESSION_COOKIE);
}

export async function isTeamAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TEAM_SESSION_COOKIE)?.value;
  if (!token) return false;
  if (!verifyToken(token)) return false;
  const invalidatedAt = await getSessionInvalidatedAt();
  if (invalidatedAt > 0) {
    const issued = Number(token.split(".")[0]);
    if (issued <= invalidatedAt) return false;
  }
  return true;
}

/** Returns true if the visitor holds either an admin or a team session. */
export async function isAnyAuthenticated(): Promise<boolean> {
  return (await isAuthenticated()) || (await isTeamAuthenticated());
}

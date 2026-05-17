// Edge-compatible — uses Web Crypto API (crypto.subtle), not node:crypto.
// Do NOT add "server-only" import — this file is used by middleware (Edge runtime).

export type DealerRole = "admin" | "exec";
export type SubscriptionStatus = "active" | "grace" | "expired" | "suspended";

export interface DealerTokenPayload {
  tenantId: string;
  userId: string;
  role: DealerRole;
  expiresAt: string; // ISO date YYYY-MM-DD — tenant subscription expiry
  status: SubscriptionStatus;
}

export interface ParsedDealerToken extends DealerTokenPayload {
  issuedAt: number; // ms since epoch
}

// Token format: issued.tenantId.userId.role.expiresAt.status.random.sig  (8 dot-separated parts)
// Body = first 7 parts joined by "."; sig = HMAC-SHA256(secret, body) as lowercase hex.

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const s = process.env.DEALER_SESSION_SECRET;
  if (!s) throw new Error("DEALER_SESSION_SECRET environment variable is required");
  return s;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function makeDealerToken(payload: DealerTokenPayload): Promise<string> {
  const issued = Date.now().toString();
  const random = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer);
  const body = [
    issued,
    payload.tenantId,
    payload.userId,
    payload.role,
    payload.expiresAt,
    payload.status,
    random,
  ].join(".");
  const key = await importKey(getSecret());
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${toHex(sigBuf)}`;
}

export async function parseDealerToken(token: string): Promise<ParsedDealerToken | null> {
  const parts = token.split(".");
  if (parts.length !== 8) return null;
  const [issued, tenantId, userId, role, expiresAt, status, , sig] = parts;
  const body = parts.slice(0, 7).join(".");

  let key: CryptoKey;
  try {
    key = await importKey(getSecret());
  } catch {
    return null;
  }

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromHex(sig),
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > TTL_MS) return null;

  if (!["admin", "exec"].includes(role)) return null;
  if (!["active", "grace", "expired", "suspended"].includes(status)) return null;
  if (!tenantId || !userId) return null;

  return {
    tenantId,
    userId,
    role: role as DealerRole,
    expiresAt,
    status: status as SubscriptionStatus,
    issuedAt,
  };
}

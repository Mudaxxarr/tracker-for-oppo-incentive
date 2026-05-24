import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { db, schema } from "./db/client";
import { eq } from "drizzle-orm";
import { BASE_INCENTIVE_PERCENT, DEFAULT_TARGET_BONUS_PERCENT } from "./constants";

const KEYS = {
  base: "constant_base_percent",
  bonus: "constant_default_bonus_percent",
} as const;

async function readNumber(key: string, fallback: number): Promise<number> {
  const rows = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, key))
    .limit(1);
  if (rows.length === 0) return fallback;
  const n = Number(rows[0].value);
  return Number.isFinite(n) ? n : fallback;
}

async function writeNumber(key: string, value: number) {
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, key))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(schema.appSettings)
      .set({ value: String(value), updatedAt: now })
      .where(eq(schema.appSettings.key, key));
  } else {
    await db
      .insert(schema.appSettings)
      .values({ key, value: String(value), updatedAt: now });
  }
}

const _getConstantsCached = unstable_cache(
  async () => {
    const [base, bonus] = await Promise.all([
      readNumber(KEYS.base, BASE_INCENTIVE_PERCENT),
      readNumber(KEYS.bonus, DEFAULT_TARGET_BONUS_PERCENT),
    ]);
    return { basePercent: base, defaultBonusPercent: bonus };
  },
  ["app-constants"],
  { revalidate: 60, tags: ["app-constants"] },
);

export async function getConstants() {
  return _getConstantsCached();
}

export async function setConstants(input: { basePercent?: number; defaultBonusPercent?: number }) {
  if (input.basePercent != null) await writeNumber(KEYS.base, input.basePercent);
  if (input.defaultBonusPercent != null)
    await writeNumber(KEYS.bonus, input.defaultBonusPercent);
  revalidateTag("app-constants", {});
}

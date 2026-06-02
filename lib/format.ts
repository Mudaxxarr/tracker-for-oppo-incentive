import { format } from "date-fns";

const PKR_FORMATTER = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const PKR_FORMATTER_PRECISE = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("en-PK");

export function formatPKR(value: number, precise = false): string {
  if (!Number.isFinite(value)) return "—";
  return precise ? PKR_FORMATTER_PRECISE.format(value) : PKR_FORMATTER.format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return NUMBER_FORMATTER.format(value);
}

export function formatDate(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy");
}

export function formatDateLong(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd MMMM yyyy, EEE");
}

export function formatMonthLabel(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  return format(d, "MMM yyyy");
}

/**
 * Date as YYYY-MM-DD in Pakistan time (UTC+5, no DST), optionally offset by days.
 * Use for business-day guards (future/backdate checks) so they don't drift on a
 * UTC server. `todayPKT()` = today in PKT; `todayPKT(-3)` = three PKT days ago.
 */
export function todayPKT(offsetDays = 0): string {
  const ms = Date.now() + 5 * 3600 * 1000 + offsetDays * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function maskImei(imei: string | null | undefined): string {
  if (!imei) return "—";
  if (imei.length <= 6) return imei;
  return `••• ${imei.slice(-6)}`;
}

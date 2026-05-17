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

export function maskImei(imei: string | null | undefined): string {
  if (!imei) return "—";
  if (imei.length <= 6) return imei;
  return `••• ${imei.slice(-6)}`;
}

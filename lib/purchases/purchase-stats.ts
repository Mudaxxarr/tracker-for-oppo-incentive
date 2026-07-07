/** Auto-generated bill label — never user-typed. Restarts at 1 per (tenant, dealer, date). */
export function formatBillNumber(purchaseDate: string, seq: number): string {
  const yymmdd = purchaseDate.slice(2).replace(/-/g, "");
  return `INV-${yymmdd}-${String(seq).padStart(3, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Equal-length window immediately preceding [from, to], for "vs previous period" deltas. */
export function computePreviousPeriod(from: string, to: string): { from: string; to: string } {
  const days = Math.round((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86_400_000) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

/** Percent change current vs previous. Null when previous is 0 (no meaningful base). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

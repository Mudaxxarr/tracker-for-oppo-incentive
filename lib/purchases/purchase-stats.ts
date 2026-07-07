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

export interface PurchaseStatsRow {
  billNumber: string;
  modelId: string;
  modelName: string;
  quantity: number;
  unitDealerPrice: number;
  purchaseDate: string;
  source: string;
}

export interface BillLine {
  modelId: string;
  modelName: string;
  quantity: number;
  unitDealerPrice: number;
  amount: number;
  source: string;
}

export interface BillGroup {
  billNumber: string;
  purchaseDate: string;
  modelCount: number;
  totalQty: number;
  totalAmount: number;
  lines: BillLine[];
}

export function groupIntoBills(rows: PurchaseStatsRow[]): BillGroup[] {
  const byBill = new Map<string, BillGroup>();
  for (const r of rows) {
    const amount = r.quantity * r.unitDealerPrice;
    let bill = byBill.get(r.billNumber);
    if (!bill) {
      bill = { billNumber: r.billNumber, purchaseDate: r.purchaseDate, modelCount: 0, totalQty: 0, totalAmount: 0, lines: [] };
      byBill.set(r.billNumber, bill);
    }
    bill.lines.push({ modelId: r.modelId, modelName: r.modelName, quantity: r.quantity, unitDealerPrice: r.unitDealerPrice, amount, source: r.source });
    bill.totalQty += r.quantity;
    bill.totalAmount += amount;
  }
  const bills = [...byBill.values()];
  for (const b of bills) b.modelCount = new Set(b.lines.map((l) => l.modelId)).size;
  return bills.sort((a, b) => (a.purchaseDate === b.purchaseDate ? (a.billNumber < b.billNumber ? 1 : -1) : a.purchaseDate < b.purchaseDate ? 1 : -1));
}

export interface TopModel { modelId: string; modelName: string; qty: number; }
export interface DailyPoint { date: string; amount: number; qty: number; }
export interface BillExtreme { billNumber: string; purchaseDate: string; amount: number; }

export interface PurchaseAggregateStats {
  billCount: number;
  totalQty: number;
  totalAmount: number;
  avgPricePerUnit: number;
  uniqueModels: number;
  crossRegionQty: number;
  avgQtyPerBill: number;
  avgAmountPerBill: number;
  highestBill: BillExtreme | null;
  lowestBill: BillExtreme | null;
  topModels: TopModel[];
  dailySeries: DailyPoint[];
}

export function aggregatePurchaseStats(rows: PurchaseStatsRow[]): PurchaseAggregateStats {
  const bills = groupIntoBills(rows);
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const totalAmount = rows.reduce((s, r) => s + r.quantity * r.unitDealerPrice, 0);
  const crossRegionQty = rows.filter((r) => r.source === "CROSS_REGION_TRANSFER_IN").reduce((s, r) => s + r.quantity, 0);

  const modelQty = new Map<string, { modelName: string; qty: number }>();
  for (const r of rows) {
    const existing = modelQty.get(r.modelId);
    if (existing) existing.qty += r.quantity;
    else modelQty.set(r.modelId, { modelName: r.modelName, qty: r.quantity });
  }
  const topModels: TopModel[] = [...modelQty.entries()]
    .map(([modelId, v]) => ({ modelId, modelName: v.modelName, qty: v.qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const dailyMap = new Map<string, { amount: number; qty: number }>();
  for (const r of rows) {
    const existing = dailyMap.get(r.purchaseDate) ?? { amount: 0, qty: 0 };
    existing.amount += r.quantity * r.unitDealerPrice;
    existing.qty += r.quantity;
    dailyMap.set(r.purchaseDate, existing);
  }
  const dailySeries: DailyPoint[] = [...dailyMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  let highestBill: BillExtreme | null = null;
  let lowestBill: BillExtreme | null = null;
  for (const b of bills) {
    const extreme: BillExtreme = { billNumber: b.billNumber, purchaseDate: b.purchaseDate, amount: b.totalAmount };
    if (!highestBill || b.totalAmount > highestBill.amount) highestBill = extreme;
    if (!lowestBill || b.totalAmount < lowestBill.amount) lowestBill = extreme;
  }

  return {
    billCount: bills.length,
    totalQty,
    totalAmount,
    avgPricePerUnit: totalQty > 0 ? totalAmount / totalQty : 0,
    uniqueModels: modelQty.size,
    crossRegionQty,
    avgQtyPerBill: bills.length > 0 ? totalQty / bills.length : 0,
    avgAmountPerBill: bills.length > 0 ? totalAmount / bills.length : 0,
    highestBill,
    lowestBill,
    topModels,
    dailySeries,
  };
}

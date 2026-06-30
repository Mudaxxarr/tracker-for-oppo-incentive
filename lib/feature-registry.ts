import type { DealerFeatureKey, DealerFeatures } from "./dealer-features";

export type BadgeKind = "new" | "beta" | "preview";

export interface FeatureNode {
  key: string;                 // flag key inside dealer_tenants.features JSON
  label: string;
  hint?: string;
  defaultOn: boolean;          // true = included (on unless explicitly false); false = paid/locked upsell (off unless true)
  monthlyPrice: number | null; // null = no separate charge
  trialDays: number;           // default trial length when broadcasting / granting
  badge?: BadgeKind;
}

export interface FeatureGroup extends FeatureNode {
  tab: DealerFeatureKey;       // the parent tab; equals this node's key
  children: FeatureNode[];     // sub-features that live inside the tab
}

// ── Single source of truth: every tab and its sub-features ───────────────────
// defaultOn=true  → included module/sub-feature (admin can turn OFF)
// defaultOn=false → paid upsell (off until granted/purchased; trial flips it on)
export const FEATURE_REGISTRY: FeatureGroup[] = [
  {
    tab: "activations", key: "activations", label: "Activations",
    defaultOn: true, monthlyPrice: null, trialDays: 7,
    children: [
      { key: "act_bulk", label: "Bulk add by date", hint: "Add many activations for one date at once", defaultOn: true, monthlyPrice: null, trialDays: 7 },
      { key: "act_bulk_delete", label: "Bulk delete", hint: "Select & delete multiple activations", defaultOn: true, monthlyPrice: null, trialDays: 7 },
    ],
  },
  {
    tab: "purchases", key: "purchases", label: "Purchases",
    defaultOn: true, monthlyPrice: null, trialDays: 7,
    children: [
      { key: "pur_bulk", label: "Bulk invoice entry", hint: "Enter a full invoice (many lines) at once", defaultOn: true, monthlyPrice: null, trialDays: 7 },
    ],
  },
  {
    tab: "inventory", key: "inventory", label: "Inventory",
    defaultOn: true, monthlyPrice: null, trialDays: 7,
    children: [
      { key: "inv_receipts", label: "Receipts / date view", hint: "Day-wise received-stock breakdown", defaultOn: true, monthlyPrice: null, trialDays: 7 },
    ],
  },
  {
    tab: "ids", key: "ids", label: "Dealer IDs",
    defaultOn: true, monthlyPrice: null, trialDays: 7, children: [],
  },
  {
    tab: "models", key: "models", label: "Models",
    defaultOn: true, monthlyPrice: null, trialDays: 7, children: [],
  },
  {
    tab: "reports", key: "reports", label: "Reports",
    defaultOn: true, monthlyPrice: null, trialDays: 7,
    children: [
      { key: "rep_incentive_pdf", label: "Incentive-only PDF", hint: "PDF limited to incentive models", defaultOn: true, monthlyPrice: null, trialDays: 7 },
      { key: "addon_detailed_pdf", label: "Detailed Breakup PDF", hint: "Audit-ready, every formula behind the total", defaultOn: false, monthlyPrice: 400, trialDays: 7, badge: "beta" },
      { key: "addon_excel", label: "Excel Exports", hint: "Full + incentive Excel workbooks", defaultOn: false, monthlyPrice: 300, trialDays: 7, badge: "new" },
    ],
  },
  {
    tab: "policies", key: "policies", label: "Policies",
    defaultOn: false, monthlyPrice: null, trialDays: 7, badge: "preview", children: [],
  },
  {
    tab: "cross_region", key: "cross_region", label: "Cross-Region",
    defaultOn: false, monthlyPrice: 400, trialDays: 7, badge: "preview", children: [],
  },
  {
    tab: "pos", key: "pos", label: "POS / Sell",
    defaultOn: false, monthlyPrice: 500, trialDays: 7, badge: "new",
    children: [
      { key: "pos_receipt", label: "Receipt PDF", hint: "Branded PDF receipt on each sale", defaultOn: true, monthlyPrice: null, trialDays: 7 },
    ],
  },
  {
    tab: "team", key: "team", label: "Team View",
    defaultOn: false, monthlyPrice: 300, trialDays: 7, badge: "preview", children: [],
  },
  {
    tab: "activity", key: "activity", label: "Activity Log",
    defaultOn: false, monthlyPrice: 200, trialDays: 7, badge: "preview", children: [],
  },
  {
    tab: "settings", key: "settings", label: "Settings",
    defaultOn: true, monthlyPrice: null, trialDays: 7,
    children: [
      { key: "set_backup", label: "Data backup download", hint: "Download a full copy of all data", defaultOn: true, monthlyPrice: null, trialDays: 7 },
      { key: "set_purge", label: "Purge old logs", hint: "One-click clear of old activity entries", defaultOn: true, monthlyPrice: null, trialDays: 7 },
    ],
  },
];

// Flat list of every node (tabs + children) — handy for save/iteration.
export const ALL_REGISTRY_NODES: FeatureNode[] = FEATURE_REGISTRY.flatMap(
  (g) => [{ key: g.key, label: g.label, defaultOn: g.defaultOn, monthlyPrice: g.monthlyPrice, trialDays: g.trialDays, badge: g.badge }, ...g.children],
);

export function getRegistryNode(key: string): FeatureNode | undefined {
  return ALL_REGISTRY_NODES.find((n) => n.key === key);
}

// Resolve whether a node is ON, honoring its default semantics.
// Works on trial-merged features (an active trial sets key=true → upsell turns on).
export function isNodeOn(features: DealerFeatures, node: FeatureNode): boolean {
  const v = (features as Record<string, boolean | undefined>)[node.key];
  return node.defaultOn ? v !== false : v === true;
}

// Lookup by key + apply default semantics. Unknown key → false.
export function isFeatureKeyOn(features: DealerFeatures, key: string): boolean {
  const node = getRegistryNode(key);
  return node ? isNodeOn(features, node) : false;
}

export const BADGE_LABEL: Record<BadgeKind, string> = { new: "New", beta: "Beta", preview: "Preview" };
export const BADGE_COLOR: Record<BadgeKind, string> = {
  new: "bg-primary/10 text-primary",
  beta: "bg-amber-500/10 text-amber-600",
  preview: "bg-violet-500/10 text-violet-600",
};

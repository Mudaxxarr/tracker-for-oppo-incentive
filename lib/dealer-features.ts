export type DealerFeatureKey =
  | "activations"
  | "purchases"
  | "inventory"
  | "ids"
  | "models"
  | "cross_region"
  | "policies"
  | "reports"
  | "settings"
  | "team"
  | "activity"
  | "customers"
  | "warranty"
  | "scripts"
  | "pos";

export type DealerFeatures = Partial<Record<DealerFeatureKey, boolean>>;

export const DEALER_FEATURE_LABELS: Record<DealerFeatureKey, string> = {
  activations: "Activations",
  purchases: "Purchases",
  inventory: "Inventory",
  ids: "Dealer IDs",
  models: "Models",
  cross_region: "Cross-Region",
  policies: "Policies",
  reports: "Reports",
  settings: "Settings",
  team: "Team View",
  activity: "Activity Log",
  customers: "Customers",
  warranty: "Warranty Claims",
  scripts: "Sales Scripts",
  pos: "POS / Sell",
};

export const ALL_FEATURE_KEYS: DealerFeatureKey[] = [
  "activations",
  "purchases",
  "inventory",
  "ids",
  "models",
  "cross_region",
  "policies",
  "reports",
  "settings",
  "team",
  "activity",
  "customers",
  "warranty",
  "scripts",
  "pos",
];

export function parseDealerFeatures(raw: string): DealerFeatures {
  try {
    return JSON.parse(raw) as DealerFeatures;
  } catch {
    return {};
  }
}

// Feature is enabled only when explicitly set to true. Absent = disabled.
export function isFeatureEnabled(features: DealerFeatures, key: DealerFeatureKey): boolean {
  return features[key] === true;
}

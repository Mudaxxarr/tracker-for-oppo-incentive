import type { DealerFeatures } from "./dealer-features";

export type DealerAddonKey = "addon_detailed_pdf" | "addon_excel";

export interface DealerAddon {
  key: DealerAddonKey;
  label: string;
  tagline: string;
  monthlyPrice: number;
  /** Faded preview lines shown in the locked state (mono, illustrative). */
  preview: string[];
}

export const DEALER_ADDONS: DealerAddon[] = [
  {
    key: "addon_detailed_pdf",
    label: "Detailed Breakup PDF",
    tagline:
      "Every formula behind your grand total: per-model quantities, sub-period rates, policy achievements and live inventory in one audit-ready PDF.",
    monthlyPrice: 400,
    preview: [
      "Reno 12 8+256        14 × 4% @ 81,999  =  45,919",
      "A3x 4+64             31 × 4% @ 27,499  =  34,099",
      "Policy: Stock-In Jun  target 40 → met ✓  +12,000",
    ],
  },
  {
    key: "addon_excel",
    label: "Excel Exports",
    tagline:
      "Full and incentive-model Excel workbooks for your own ledger, pivots and accountant.",
    monthlyPrice: 300,
    preview: [
      "report_full_2026-06.xlsx        9 columns × all models",
      "report_incentive_2026-06.xlsx   incentive models only",
    ],
  },
];

export function getAddon(key: string): DealerAddon | undefined {
  return DEALER_ADDONS.find((a) => a.key === key);
}

// Add-on flags live in the same dealer_tenants.features JSON as core flags.
export function isAddonEnabled(features: DealerFeatures, key: DealerAddonKey): boolean {
  return (features as Record<string, boolean | undefined>)[key] === true;
}

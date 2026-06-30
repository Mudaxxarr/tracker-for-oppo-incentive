import type { DealerFeatureKey } from "./dealer-features";
import type { DealerAddonKey } from "./dealer-addons";

export type PreviewKey = DealerFeatureKey | DealerAddonKey;

export interface PreviewFeature {
  key: PreviewKey;
  label: string;
  badge: "new" | "beta" | "preview";
  tagline: string;
  highlights: string[];
  trialDays: number;
  monthlyPrice: number | null; // null = included in plan, just gated
}

export const PREVIEW_CATALOG: PreviewFeature[] = [
  {
    key: "pos",
    label: "POS / Sell",
    badge: "new",
    tagline: "Full point-of-sale: cart → customer → log sale → PDF receipt in one flow.",
    highlights: [
      "Cart with model picker and qty",
      "Customer lookup or quick-create",
      "Auto-logs activation on sale",
      "PDF receipt with shop branding",
    ],
    trialDays: 7,
    monthlyPrice: 500,
  },
  {
    key: "cross_region",
    label: "Cross-Region Transfers",
    badge: "preview",
    tagline: "Move stock between dealer IDs with owner approval and full audit trail.",
    highlights: [
      "Send / receive requests between IDs",
      "Owner approval before stock moves",
      "CR-Caught tracking with fine logging",
      "Full history in Activity Log",
    ],
    trialDays: 7,
    monthlyPrice: 400,
  },
  {
    key: "team",
    label: "Team View",
    badge: "preview",
    tagline: "Add a second Sales Officer to your account with read-only access.",
    highlights: [
      "Up to 2 team members per account",
      "SO role: view activations & stock",
      "Separate login credentials",
      "Activity tracked per member",
    ],
    trialDays: 7,
    monthlyPrice: 300,
  },
  {
    key: "addon_excel",
    label: "Excel Exports",
    badge: "new",
    tagline: "Download full and incentive-model Excel workbooks for your ledger and accountant.",
    highlights: [
      "Full report workbook (all models, all columns)",
      "Incentive-only workbook",
      "Compatible with Google Sheets & Excel",
      "One-click download from Reports page",
    ],
    trialDays: 7,
    monthlyPrice: 300,
  },
  {
    key: "addon_detailed_pdf",
    label: "Detailed Breakup PDF",
    badge: "beta",
    tagline: "Audit-ready PDF showing every formula behind your grand total.",
    highlights: [
      "Per-model qty × rate breakdown",
      "Policy achievement status",
      "Live inventory at period end",
      "Sub-period rate changes included",
    ],
    trialDays: 7,
    monthlyPrice: 400,
  },
  {
    key: "activity",
    label: "Activity Log",
    badge: "preview",
    tagline: "Full audit trail of every change made in your account.",
    highlights: [
      "Every create, edit, delete logged",
      "Filter by date range and action type",
      "Purge old logs with one click",
      "Accountant-friendly export",
    ],
    trialDays: 7,
    monthlyPrice: 200,
  },
];

export function getPreview(key: string): PreviewFeature | undefined {
  return PREVIEW_CATALOG.find((p) => p.key === key);
}

export const BADGE_LABEL: Record<PreviewFeature["badge"], string> = {
  new: "New",
  beta: "Beta",
  preview: "Preview",
};

export const BADGE_COLOR: Record<PreviewFeature["badge"], string> = {
  new: "bg-primary/10 text-primary",
  beta: "bg-amber-500/10 text-amber-600",
  preview: "bg-violet-500/10 text-violet-600",
};

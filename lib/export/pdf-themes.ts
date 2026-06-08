export type PdfTheme = {
  // Header band
  headerBg: string;
  headerFg: string;
  headerSub: string;
  // Accent / KPI
  accent: string;
  kpiBg: string;
  kpiBdr: string;
  kpiLabel: string;
  // Grand total card
  grandBg: string;
  grandFg: string;
  grandSub: string;
  // Table
  tHeadBg: string;
  tHeadFg: string;
  tAlt: string;
  tBorder: string;
  tTotalBg: string;
  tTotalFg: string;
  // Status
  green: string;
  greenBg: string;
  red: string;
  redBg: string;
  // Typography
  text: string;
  muted: string;
  light: string;
  // Layout mode — true = Arctic (no dark fills, ruled separators, flat tiles)
  minimal: boolean;
};

export const NAVAL: PdfTheme = {
  headerBg:  "#0B1629",
  headerFg:  "#FFFFFF",
  headerSub: "#93C5FD",
  accent:    "#2563EB",
  kpiBg:     "#EFF6FF",
  kpiBdr:    "#BFDBFE",
  kpiLabel:  "#1E40AF",
  grandBg:   "#1E3A5F",
  grandFg:   "#FFFFFF",
  grandSub:  "#93C5FD",
  tHeadBg:   "#1E293B",
  tHeadFg:   "#FFFFFF",
  tAlt:      "#F8FAFC",
  tBorder:   "#E2E8F0",
  tTotalBg:  "#EFF6FF",
  tTotalFg:  "#1E40AF",
  green:     "#15803D",
  greenBg:   "#F0FDF4",
  red:       "#B91C1C",
  redBg:     "#FFF1F2",
  text:      "#0F172A",
  muted:     "#64748B",
  light:     "#94A3B8",
  minimal:   false,
};

export const ARCTIC: PdfTheme = {
  headerBg:  "#FFFFFF",
  headerFg:  "#1D1D1F",   // Apple near-black
  headerSub: "#6E6E73",   // Apple secondary gray
  accent:    "#1D1D1F",
  kpiBg:     "#F5F5F7",   // Apple near-white
  kpiBdr:    "#E8E8ED",   // Apple divider
  kpiLabel:  "#6E6E73",   // Apple secondary gray
  grandBg:   "#1D1D1F",
  grandFg:   "#FFFFFF",
  grandSub:  "#86868B",   // Apple tertiary gray
  tHeadBg:   "#1D1D1F",
  tHeadFg:   "#FFFFFF",
  tAlt:      "#F5F5F7",
  tBorder:   "#E8E8ED",   // Apple divider — slightly cooler than gray-200
  tTotalBg:  "#F5F5F7",
  tTotalFg:  "#1D1D1F",
  green:     "#1A7F37",
  greenBg:   "#F0FDF4",
  red:       "#C00000",
  redBg:     "#FFF9F9",
  text:      "#1D1D1F",   // Apple near-black
  muted:     "#6E6E73",   // Apple secondary gray
  light:     "#86868B",   // Apple tertiary gray
  minimal:   true,
};
